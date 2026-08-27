import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import NetworkMap from './components/NetworkMap.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import Console from './components/Console.jsx'
import { freshHospitals, externals, meshPairs, escalationPairs, TICK_MS } from './data/network.js'
import { computeForecast, bestSurplusNeighbor, transferMinutes, dist, lineKey, clamp } from './lib/forecast.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export default function App() {
  const [hospitals, setHospitals] = useState(() => freshHospitals())
  const [selectedId, setSelectedId] = useState(null)
  const [feedEvents, setFeedEvents] = useState([])
  const [logEvents, setLogEvents] = useState([])
  const [simRunning, setSimRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('feed')
  const [clockText, setClockText] = useState(() => new Date().toLocaleTimeString([], { hour12: false }))
  const [activeTransferKeys, setActiveTransferKeys] = useState(() => new Set())

  const mapRef = useRef(null)
  const hospitalsRef = useRef(hospitals)
  const simRunningRef = useRef(false)
  const simClockRef = useRef(0)

  useEffect(() => {
    hospitalsRef.current = hospitals
  }, [hospitals])

  // --- clock ---
  useEffect(() => {
    const handle = setInterval(() => {
      setClockText(new Date().toLocaleTimeString([], { hour12: false }))
    }, 1000)
    return () => clearInterval(handle)
  }, [])

  // --- console helpers ---
  function pushFeed(level, html) {
    const t = new Date().toLocaleTimeString([], { hour12: false })
    setFeedEvents((prev) => {
      const next = [{ time: t, level, html }, ...prev]
      if (next.length > 60) next.pop()
      return next
    })
  }
  function pushLog(level, html) {
    simClockRef.current += Math.floor(Math.random() * 2) + 1
    const mm = String(simClockRef.current).padStart(2, '0')
    setLogEvents((prev) => [{ time: `T+${mm}m`, level, html }, ...prev])
  }

  // --- live telemetry tick: simulates an autonomous hospital feed ---
  useEffect(() => {
    function tick() {
      if (simRunningRef.current) return
      const current = hospitalsRef.current
      const working = current.map((h) => ({ ...h, history: [...h.history] }))
      const shuffled = [...working].sort(() => Math.random() - 0.5)
      const picks = shuffled.slice(0, 1 + (Math.random() < 0.4 ? 1 : 0))
      const messages = []

      picks.forEach((h) => {
        const roll = Math.random()
        let delta = 0
        let reason = ''
        if (roll < 0.55) {
          delta = -Math.round(h.dailyConsumption / 6)
          reason = 'routine transfusion draw'
        } else if (roll < 0.75) {
          delta = Math.round(Math.random() * 2)
          reason = 'restock from scheduled supply run'
        } else {
          delta = 0
          reason = 'inventory check — no change'
        }
        const before = h.available
        h.available = clamp(h.available + delta, 0, 55)
        h.history.push(h.available)
        if (h.history.length > 20) h.history.shift()

        if (Math.random() < 0.5) {
          h.patients = clamp(
            h.patients + (Math.random() < 0.5 ? -1 : 1),
            Math.round(h.baselinePatients * 0.8),
            Math.round(h.baselinePatients * 1.4)
          )
        }

        if (delta !== 0) {
          messages.push({ level: 'warn', html: `<b>${h.name}</b> inventory ${before} → ${h.available} units (${reason}).` })
        } else {
          messages.push({ level: 'ok', html: `<b>${h.name}</b> telemetry synced — ${reason}.` })
        }
      })

      setHospitals(working)
      messages.forEach((m) => pushFeed(m.level, m.html))
    }

    const handle = setInterval(tick, TICK_MS)
    return () => clearInterval(handle)
  }, [])

  // seed a couple of feed lines on mount
  useEffect(() => {
    pushFeed('ok', 'Telemetry link established with all 4 remote hospitals.')
    pushFeed('ok', 'Regional Blood Bank and 2 external suppliers online.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- KPIs ---
  const kpis = useMemo(() => {
    const forecasts = hospitals.map((h) => ({ h, f: computeForecast(h) }))
    const atRiskCount = forecasts.filter((x) => x.f.risk !== 'stable').length
    const totalShortage = forecasts.reduce((s, x) => s + x.f.shortage, 0)
    const activeEmergencies = hospitals.filter((h) => h.pph).length
    return {
      atRiskCount,
      totalShortage,
      activeEmergencies,
      riskClass: atRiskCount >= 2 ? 'crit' : atRiskCount === 1 ? 'warn' : 'ok',
      shortageClass: totalShortage > 15 ? 'crit' : totalShortage > 0 ? 'warn' : 'ok',
      emergencyClass: activeEmergencies > 0 ? 'crit' : 'ok',
    }
  }, [hospitals])

  const isAlert = hospitals.some((h) => h.pph)
  const selectedHospital = hospitals.find((h) => h.id === selectedId) || null

  function selectHospital(id) {
    setSelectedId(id)
  }

  function resetNetwork() {
    setHospitals(freshHospitals())
    setSelectedId(null)
    setFeedEvents([])
    setLogEvents([])
    simClockRef.current = 0
    setActiveTransferKeys(new Set())
  }

  // --- emergency simulation: mutates a local working copy, committing to
  // state after each step so the UI updates in step with the drone flights ---
  async function simulateEmergency(hospitalId) {
    if (simRunningRef.current) return
    simRunningRef.current = true
    setSimRunning(true)
    setActiveTab('log')

    const working = hospitalsRef.current.map((h) => ({ ...h, history: [...h.history] }))
    const h = working.find((x) => x.id === hospitalId)
    h.pph += 1
    setHospitals(working.map((w) => ({ ...w })))

    pushLog('crit', `<b>${h.name}</b> triggered a PPH emergency. Recalculating projected demand.`)
    await sleep(500)

    let f = computeForecast(h)
    pushLog('crit', `Total projected requirement for <b>${h.name}</b> is now ${f.requirement48} units (shortage: ${f.shortage}).`)
    await sleep(400)

    if (f.shortage <= 0) {
      pushLog('ok', `Emergency can be handled locally at <b>${h.name}</b> — no transfer required.`)
      simRunningRef.current = false
      setSimRunning(false)
      return
    }

    pushLog('warn', `<b>${h.name}</b>'s own inventory is insufficient. Searching neighboring hospitals for surplus.`)
    await sleep(400)

    let remaining = f.shortage
    const neighbors = bestSurplusNeighbor(h, working)
    if (!neighbors.length) {
      pushLog('crit', 'No neighboring hospital holds surplus stock. Escalating beyond the remote network.')
    }

    for (const n of neighbors) {
      if (remaining <= 0) break
      const take = Math.min(n.surplus, remaining)
      const km = n.distance
      const mins = transferMinutes(km)

      pushLog(
        'warn',
        `Recommended source: <b>${n.hospital.name}</b> — distance ${Math.round(km)} km, surplus ${n.surplus} units, dispatching drone (~${mins} min).`
      )
      const key = lineKey(h.id, n.hospital.id)
      setActiveTransferKeys((prev) => new Set(prev).add(key))

      // eslint-disable-next-line no-await-in-loop
      await mapRef.current.animateDrone(n.hospital, h, take, clamp(1200 + mins * 60, 1400, 3200))

      n.hospital.available -= take
      h.available += take
      n.hospital.history.push(n.hospital.available)
      h.history.push(h.available)
      remaining -= take

      setActiveTransferKeys((prev) => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
      setHospitals(working.map((w) => ({ ...w })))
      pushLog('ok', `${take} units delivered from <b>${n.hospital.name}</b> to <b>${h.name}</b>.`)
      // eslint-disable-next-line no-await-in-loop
      await sleep(300)
    }

    if (remaining > 0) {
      pushLog('crit', `Remote network could not fully cover the gap. Escalating remaining ${remaining} units to the Regional Blood Bank.`)
      await sleep(400)
      const bank = externals.bloodBank
      const km = dist(h, bank)
      const mins = transferMinutes(km)
      pushLog('warn', `Regional Blood Bank confirms availability — distance ${Math.round(km)} km, dispatching drone (~${mins} min).`)
      await mapRef.current.animateDrone(bank, h, remaining, clamp(1200 + mins * 60, 1600, 3400))
      h.available += remaining
      h.history.push(h.available)
      pushLog('ok', `${remaining} units delivered from <b>Regional Blood Bank</b> to <b>${h.name}</b>. Shortage resolved.`)
      remaining = 0
    }

    setHospitals(working.map((w) => ({ ...w })))
    simRunningRef.current = false
    setSimRunning(false)
  }

  return (
    <>
      <Header kpis={kpis} clockText={clockText} isAlert={isAlert} onReset={resetNetwork} />

      <main className="layout">
        <Sidebar hospitals={hospitals} selectedId={selectedId} onSelect={selectHospital} />

        <section className="map-col">
          <div className="map-toolbar">
            <span className="map-title">Regional network map</span>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: 'var(--green)' }}></span>Stable
              </span>
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: 'var(--amber)' }}></span>Watch
              </span>
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: 'var(--red)' }}></span>At risk
              </span>
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: 'var(--blue)' }}></span>Drone en route
              </span>
            </div>
          </div>
          <NetworkMap
            ref={mapRef}
            hospitals={hospitals}
            externals={externals}
            meshPairs={meshPairs}
            escalationPairs={escalationPairs}
            selectedId={selectedId}
            onSelect={selectHospital}
            activeTransferKeys={activeTransferKeys}
          />
        </section>

        <aside className={'panel-col' + (selectedId ? ' open' : '')}>
          <DetailPanel
            hospital={selectedHospital}
            hospitals={hospitals}
            simRunning={simRunning}
            onSimulate={simulateEmergency}
            onClose={() => setSelectedId(null)}
          />
        </aside>

        <Console feedEvents={feedEvents} logEvents={logEvents} activeTab={activeTab} onTabChange={setActiveTab} />
      </main>

      <div className={'scrim' + (selectedId ? ' show' : '')} onClick={() => setSelectedId(null)}></div>

      <footer>Simulated demonstration data — decision-support prototype, not connected to live hospital systems.</footer>
    </>
  )
}

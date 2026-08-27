import { forwardRef, useImperativeHandle, useRef } from 'react'
import { computeForecast, riskColor, lineKey, dist, transferMinutes } from '../lib/forecast.js'

const SVGNS = 'http://www.w3.org/2000/svg'

function makeEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  return e
}

/**
 * Renders the mesh map. Hospital nodes and lines are plain declarative JSX
 * (they re-render whenever `hospitals` changes), but the drone dispatch
 * sequence is done imperatively via raw DOM nodes appended to the SVG ref —
 * exposed through `animateDrone()` on the ref — so a 60fps flight animation
 * doesn't trigger a React re-render on every frame.
 */
const NetworkMap = forwardRef(function NetworkMap(
  { hospitals, externals, meshPairs, escalationPairs, selectedId, onSelect, activeTransferKeys },
  ref
) {
  const svgRef = useRef(null)
  const bannerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    animateDrone(fromNode, toNode, units, durationMs) {
      return new Promise((resolve) => {
        const svg = svgRef.current
        if (!svg) {
          resolve()
          return
        }

        const trail = makeEl('path', {
          class: 'drone-trail',
          d: `M${fromNode.x},${fromNode.y} L${fromNode.x},${fromNode.y}`,
        })
        svg.appendChild(trail)

        const droneGroup = makeEl('g', { transform: `translate(${fromNode.x},${fromNode.y})` })
        const glow = makeEl('circle', { cx: 0, cy: 0, r: 16, class: 'drone-glow' })
        const body = makeEl('rect', { x: -8, y: -4, width: 16, height: 8, rx: 2, class: 'drone-body' })
        const rotors = [
          makeEl('circle', { cx: -9, cy: -6, r: 3, class: 'drone-rotor' }),
          makeEl('circle', { cx: 9, cy: -6, r: 3, class: 'drone-rotor' }),
          makeEl('circle', { cx: -9, cy: 6, r: 3, class: 'drone-rotor' }),
          makeEl('circle', { cx: 9, cy: 6, r: 3, class: 'drone-rotor' }),
        ]
        rotors.forEach((r) => {
          r.innerHTML = '<animate attributeName="opacity" values="1;0.3;1" dur="0.18s" repeatCount="indefinite" />'
        })
        droneGroup.appendChild(glow)
        droneGroup.appendChild(body)
        rotors.forEach((r) => droneGroup.appendChild(r))
        svg.appendChild(droneGroup)

        const totalKm = dist(fromNode, toNode)
        const totalMin = transferMinutes(totalKm)
        const start = performance.now()
        const angle = (Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180) / Math.PI

        function frame(now) {
          const t = Math.min(1, (now - start) / durationMs)
          const x = fromNode.x + (toNode.x - fromNode.x) * t
          const y = fromNode.y + (toNode.y - fromNode.y) * t
          droneGroup.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`)
          trail.setAttribute('d', `M${fromNode.x},${fromNode.y} L${x},${y}`)

          if (bannerRef.current) {
            const remainingTotalMin = totalMin * (1 - t)
            const mm = String(Math.floor(remainingTotalMin)).padStart(2, '0')
            const ss = String(Math.round((remainingTotalMin - Math.floor(remainingTotalMin)) * 60)).padStart(2, '0')
            bannerRef.current.innerHTML = `<span class="tag">🚁 ${fromNode.name} → ${toNode.name}</span> · ${units} units <span class="eta">ETA ${mm}:${ss}</span>`
            bannerRef.current.className = 'dispatch-banner show'
          }

          if (t < 1) {
            requestAnimationFrame(frame)
          } else {
            if (bannerRef.current) {
              bannerRef.current.innerHTML = `<span class="delivered">✓ Delivered</span> — ${units} units at ${toNode.name}`
            }
            setTimeout(() => {
              svg.removeChild(trail)
              svg.removeChild(droneGroup)
              if (bannerRef.current) bannerRef.current.classList.remove('show')
              resolve()
            }, 900)
          }
        }
        requestAnimationFrame(frame)
      })
    },
  }))

  function byId(id) {
    return hospitals.find((h) => h.id === id) || externals[id]
  }

  return (
    <div className="map-frame">
      <div className="dispatch-banner" ref={bannerRef}></div>
      <svg
        id="network"
        ref={svgRef}
        viewBox="0 0 1000 640"
        role="img"
        aria-label="Map of the remote hospital blood-sharing network and external suppliers"
      >
        <rect x={165} y={235} width={670} height={375} rx={14} className="zone-box" />
        <text x={185} y={255} className="zone-label">
          REMOTE NETWORK
        </text>

        {escalationPairs.map(([a, b]) => {
          const A = byId(a)
          const B = byId(b)
          return <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className="escalation-line" />
        })}

        {meshPairs.map(([a, b]) => {
          const A = byId(a)
          const B = byId(b)
          const key = lineKey(a, b)
          const active = activeTransferKeys.has(key)
          return (
            <line
              key={key}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              className={active ? 'mesh-line active-transfer' : 'mesh-line'}
            />
          )
        })}

        {Object.values(externals).map((node) => (
          <g className="external-node" key={node.id}>
            <rect x={node.x - 66} y={node.y - 24} width={132} height={48} rx={8} />
            <text x={node.x} y={node.y - 2} textAnchor="middle" className="node-label-name">
              {node.name}
            </text>
            <text x={node.x} y={node.y + 15} textAnchor="middle" className="node-label-sub">
              {node.kind === 'bank' ? 'Upstream supplier' : 'Larger hospital'}
            </text>
          </g>
        ))}

        {hospitals.map((h) => {
          const f = computeForecast(h)
          const color = riskColor(f.risk)
          return (
            <g
              key={h.id}
              className={'node-group' + (h.id === selectedId ? ' selected' : '')}
              tabIndex={0}
              role="button"
              aria-label={`${h.name}, status ${f.risk.replace('-', ' ')}, ${h.available} units available`}
              onClick={() => onSelect(h.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(h.id)
                }
              }}
            >
              <circle cx={h.x} cy={h.y} r={36} fill={color} opacity={h.pph ? 0.16 : 0.07} />
              {h.pph > 0 && (
                <circle cx={h.x} cy={h.y} r={34} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7}>
                  <animate attributeName="r" values="24;44;24" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={h.x} cy={h.y} r={24} fill="var(--panel)" stroke={color} strokeWidth={2.5} className="node-circle" />
              <g transform={`translate(${h.x - 7},${h.y - 7})`}>
                <rect x={5} y={0} width={4} height={14} rx={1} fill={color} />
                <rect x={0} y={5} width={14} height={4} rx={1} fill={color} />
              </g>
              <text x={h.x} y={h.y - 36} textAnchor="middle" className="node-label-name">
                {h.name}
              </text>
              <text x={h.x} y={h.y + 45} textAnchor="middle" className="node-label-sub">
                {h.available} units · {h.bloodType} · {f.risk.toUpperCase()}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
})

export default NetworkMap

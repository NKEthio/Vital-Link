import { computeForecast, riskColorHex } from '../lib/forecast.js'

function sparklinePath(history, w, h) {
  const max = Math.max(...history, 1)
  const min = Math.min(...history, 0)
  const range = Math.max(1, max - min)
  const step = w / (history.length - 1 || 1)
  return history
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export default function Sidebar({ hospitals, selectedId, onSelect }) {
  return (
    <nav className="sidebar" aria-label="Facilities">
      <div className="sidebar-title">Facilities</div>
      <div>
        {hospitals.map((h) => {
          const f = computeForecast(h)
          const path = sparklinePath(h.history.slice(-8), 70, 22)
          return (
            <div
              key={h.id}
              className={'facility-card' + (h.id === selectedId ? ' selected' : '')}
              tabIndex={0}
              role="button"
              aria-label={`${h.name}, ${f.risk}`}
              onClick={() => onSelect(h.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(h.id)
                }
              }}
            >
              <div className="facility-top">
                <div className="facility-name-row">
                  <span className={'status-dot ' + f.risk}></span>
                  <span className="facility-name">{h.name}</span>
                </div>
                <span className="facility-chip">{h.bloodType}</span>
              </div>
              <div className="facility-bottom">
                <div className="facility-units">
                  {h.available}
                  <span className="u">units</span>
                </div>
                <svg className="spark" viewBox="0 0 70 22" preserveAspectRatio="none">
                  <path d={path} stroke={riskColorHex(f.risk)} />
                </svg>
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

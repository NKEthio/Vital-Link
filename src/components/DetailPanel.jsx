import { computeForecast, generateReasons, recommendationText, patientLoadPct, riskColor } from '../lib/forecast.js'

function FlagIcon({ level }) {
  const isOk = level === 'ok'
  return (
    <span className={'flag-icon ' + level}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isOk ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        )}
      </svg>
    </span>
  )
}

export default function DetailPanel({ hospital, hospitals, simRunning, onSimulate, onClose }) {
  if (!hospital) {
    return (
      <div className="panel-inner">
        <div className="panel-empty">
          <b>Select a hospital</b> from the sidebar or map to see live inventory, 48-hour forecast, and risk explanation.
        </div>
      </div>
    )
  }

  const h = hospital
  const f = computeForecast(h)
  const reasons = generateReasons(h, hospitals)
  const rec = recommendationText(h, hospitals)
  const loadPct = patientLoadPct(h)

  return (
    <div className="panel-inner">
      <button className="panel-close" aria-label="Close panel" onClick={onClose}>
        ✕
      </button>

      <div className="panel-header">
        <div>
          <div className="panel-eyebrow">Hospital detail</div>
          <h2 className="panel-title">{h.name}</h2>
        </div>
        <span className={'status-pill ' + f.risk}>{f.risk.replace('-', ' ')}</span>
      </div>

      <div className="section-label">Current situation</div>
      <div className="stat-grid">
        <div className="stat-cell">
          <div className="k">Patients</div>
          <div className="v">
            {h.patients}{' '}
            <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              ({loadPct >= 0 ? '+' : ''}
              {loadPct}%)
            </span>
          </div>
        </div>
        <div className="stat-cell">
          <div className="k">Expected arrivals</div>
          <div className="v">{h.expectedIncoming}</div>
        </div>
        <div className="stat-cell">
          <div className="k">Maternity patients</div>
          <div className="v">{h.maternity}</div>
        </div>
        <div className="stat-cell">
          <div className="k">Active PPH cases</div>
          <div className="v" style={{ color: h.pph ? 'var(--red)' : 'inherit' }}>
            {h.pph}
          </div>
        </div>
      </div>

      <div className="section-label">Blood inventory · {h.bloodType}</div>
      <div className="inv-bar-row">
        <div className="labels">
          <span>Available</span>
          <span className="v">{h.available} units</span>
        </div>
        <div className="inv-track">
          <div
            className="inv-fill"
            style={{ width: `${Math.min(100, (h.available / 40) * 100)}%`, background: riskColor(f.risk) }}
          ></div>
        </div>
      </div>
      <div className="inv-bar-row">
        <div className="labels">
          <span>Current need</span>
          <span className="v">{h.needed} units</span>
        </div>
        <div className="inv-track">
          <div
            className="inv-fill"
            style={{ width: `${Math.min(100, (h.needed / 40) * 100)}%`, background: 'var(--text-faint)' }}
          ></div>
        </div>
      </div>
      <div className="inv-bar-row">
        <div className="labels">
          <span>Avg. daily consumption</span>
          <span className="v">{h.dailyConsumption} units/day</span>
        </div>
      </div>

      <div className="section-label">48-hour forecast</div>
      <div className="forecast-box">
        <div className="forecast-row">
          <span>Estimated requirement</span>
          <span className="v">{f.requirement48} units</span>
        </div>
        <div className="forecast-row">
          <span>Available now</span>
          <span className="v">{h.available} units</span>
        </div>
        <div className="forecast-row">
          <span>Projected shortage</span>
          <span className="v" style={{ color: f.shortage > 0 ? 'var(--red)' : 'var(--green)' }}>
            {f.shortage} units
          </span>
        </div>
        {f.hoursToShortage !== null && (
          <div className="forecast-row">
            <span>Time to shortage</span>
            <span className="v">~{f.hoursToShortage} hrs</span>
          </div>
        )}
        <div className={'forecast-flag ' + f.risk}>
          {f.risk === 'at-risk'
            ? `SHORTAGE EXPECTED IN ~${f.hoursToShortage} HOURS`
            : f.risk === 'watch'
              ? 'SUPPLY IS TIGHT — MONITOR CLOSELY'
              : 'SUPPLY IS STABLE'}
        </div>
      </div>

      <div className="section-label">Why is this hospital at risk?</div>
      <ul className="reasons-list">
        {reasons.map((r, i) => (
          <li key={i}>
            <FlagIcon level={r.level} />
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <div className="recommend-box">
        <b>Recommended action:</b> <span dangerouslySetInnerHTML={{ __html: rec }} />
      </div>

      <button className="simulate-btn" disabled={simRunning} onClick={() => onSimulate(h.id)}>
        {h.pph ? '⚠ Escalate emergency again' : '⚠ Simulate PPH emergency'}
      </button>
    </div>
  )
}

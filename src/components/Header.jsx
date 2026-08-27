function KpiIcon({ name }) {
  const paths = {
    risk: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
    shortage: <path d="M6 3v18M6 3a4 4 0 0 1 4 4v3a4 4 0 0 0 4 4v0a4 4 0 0 1 4 4v2" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

export default function Header({ kpis, clockText, isAlert, onReset }) {
  return (
    <header className="app-header">
      <div className="pulse-track" aria-hidden="true">
        <svg viewBox="0 0 600 60" preserveAspectRatio="none">
          <g className={'pulse-group' + (isAlert ? ' alert-speed' : '')}>
            <path
              className={'pulse-line' + (isAlert ? ' alert' : '')}
              d="M0,30 L40,30 L52,10 L64,50 L76,30 L120,30 L132,18 L142,42 L154,30 L600,30"
            />
            <path
              className={'pulse-line' + (isAlert ? ' alert' : '')}
              d="M0,30 L40,30 L52,10 L64,50 L76,30 L120,30 L132,18 L142,42 L154,30 L600,30"
              transform="translate(600,0)"
            />
          </g>
        </svg>
      </div>

      <div className="header-row">
        <div className="brand-block">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4 6 4c2 0 3.5 1.1 4.3 2.3C11.5 8.8 12 9 12 9s.5-.2 1.7-2.7C14.5 5.1 16 4 18 4c4 0 5.6 4 4 7.7C19.5 16.4 12 21 12 21z" />
              <path d="M9 11h2l1-2 2 4 1-2h2" />
            </svg>
          </div>
          <div>
            <p className="brand-eyebrow">Vitalink · Regional coordination</p>
            <h1 className="brand">Emergency Blood Network</h1>
            <p className="brand-sub">
              Regional monitoring · <b>4</b> remote hospitals · <b>2</b> external suppliers · <b>1</b> blood bank
            </p>
          </div>
        </div>
        <div className="header-actions">
          <span className="btn ghost">
            <span className="dot-live"></span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{clockText}</span>
          </span>
          <button className="btn" onClick={onReset}>
            ↺ Reset network
          </button>
        </div>
      </div>

      <div className="kpi-bar" role="group" aria-label="Network status summary">
        <div className={'kpi ' + kpis.riskClass}>
          <div className="kpi-icon">
            <KpiIcon name="risk" />
          </div>
          <div>
            <span className="kpi-label">Hospitals at risk</span>
            <span className="kpi-value">
              {kpis.atRiskCount} <span className="unit">/ 4</span>
            </span>
          </div>
        </div>
        <div className={'kpi ' + kpis.shortageClass}>
          <div className="kpi-icon">
            <KpiIcon name="shortage" />
          </div>
          <div>
            <span className="kpi-label">Projected network shortage</span>
            <span className="kpi-value">
              {kpis.totalShortage} <span className="unit">units</span>
            </span>
          </div>
        </div>
        <div className={'kpi ' + kpis.emergencyClass}>
          <div className="kpi-icon">
            <KpiIcon name="clock" />
          </div>
          <div>
            <span className="kpi-label">Active emergencies</span>
            <span className="kpi-value">{kpis.activeEmergencies}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

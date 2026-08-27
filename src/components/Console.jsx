function LogList({ events, emptyText }) {
  if (!events.length) {
    return <div className="log-empty">{emptyText}</div>
  }
  return (
    <>
      {events.map((e, i) => (
        <div className={'log-item ' + e.level} key={i}>
          <span className="log-time">{e.time}</span>
          <span className="log-text" dangerouslySetInnerHTML={{ __html: e.html }} />
        </div>
      ))}
    </>
  )
}

export default function Console({ feedEvents, logEvents, activeTab, onTabChange }) {
  return (
    <section className="console-col">
      <div className="console-frame">
        <div className="console-tabs">
          <button
            className={'console-tab' + (activeTab === 'feed' ? ' active' : '')}
            onClick={() => onTabChange('feed')}
          >
            Live telemetry <span className="count">{feedEvents.length}</span>
          </button>
          <button
            className={'console-tab' + (activeTab === 'log' ? ' active' : '')}
            onClick={() => onTabChange('log')}
          >
            Emergency response <span className="count">{logEvents.length}</span>
          </button>
        </div>
        <div className="console-body" style={{ display: activeTab === 'feed' ? 'block' : 'none' }}>
          <LogList events={feedEvents} emptyText="Listening for hospital telemetry…" />
        </div>
        <div className="console-body" style={{ display: activeTab === 'log' ? 'block' : 'none' }}>
          <LogList events={logEvents} emptyText="No activity yet. Simulate an emergency to see the network respond." />
        </div>
      </div>
    </section>
  )
}

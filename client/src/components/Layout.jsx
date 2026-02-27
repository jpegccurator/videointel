import DisclaimerBanner from './DisclaimerBanner';

const TABS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'library', label: 'Library' },
  { id: 'show', label: 'Show Generator' },
  { id: 'outcomes', label: 'Outcomes' },
];

export default function Layout({ activeTab, onTabChange, onSettingsClick, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DisclaimerBanner />

      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-brand">VideoIntel</span>

          <div className="nav-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="nav-actions">
            <button
              className="btn-icon"
              onClick={onSettingsClick}
              title="Settings"
              style={{ fontSize: '1.1rem' }}
            >
              &#9881;
            </button>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        <div className="container">
          <div className="page-content">{children}</div>
        </div>
      </main>

      <footer className="footer">
        Built by{' '}
        <a href="https://twitter.com/alessandrorisk" target="_blank" rel="noopener noreferrer">
          @alessandrorisk
        </a>
      </footer>
    </div>
  );
}

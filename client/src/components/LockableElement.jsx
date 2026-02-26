export default function LockableElement({
  label,
  locked,
  onToggleLock,
  onRegenerate,
  regenerating,
  children,
}) {
  return (
    <div className="show-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="show-section-label">{label}</span>
        <div className="lockable-controls" style={{ position: 'static' }}>
          <button
            className={`btn-icon ${locked ? 'active' : ''}`}
            onClick={onToggleLock}
            title={locked ? 'Unlock' : 'Lock'}
          >
            {locked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
          </button>
          <button
            className="btn-icon"
            onClick={onRegenerate}
            disabled={locked || regenerating}
            title="Regenerate"
          >
            &#x21bb;
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

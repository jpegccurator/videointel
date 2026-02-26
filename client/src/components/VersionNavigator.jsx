export default function VersionNavigator({ currentVersion, totalVersions, onNavigate }) {
  if (totalVersions <= 1) return null;

  return (
    <div className="version-nav">
      <button
        className="btn-icon"
        onClick={() => onNavigate(currentVersion - 1)}
        disabled={currentVersion <= 1}
        title="Previous version"
        style={{ fontSize: '0.85rem' }}
      >
        &#8592;
      </button>
      <span>
        v{currentVersion} of {totalVersions}
      </span>
      <button
        className="btn-icon"
        onClick={() => onNavigate(currentVersion + 1)}
        disabled={currentVersion >= totalVersions}
        title="Next version"
        style={{ fontSize: '0.85rem' }}
      >
        &#8594;
      </button>
    </div>
  );
}

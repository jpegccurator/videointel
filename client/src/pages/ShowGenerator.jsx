import { useState, useCallback, useEffect } from 'react';
import LockableElement from '../components/LockableElement';
import VersionNavigator from '../components/VersionNavigator';
import VerificationBadge from '../components/VerificationBadge';
import ExpandableSection from '../components/ExpandableSection';
import StyleConfig from '../components/StyleConfig';
import { apiFetch, buildLibraryContext } from '../utils/api';

const MAX_VERSIONS = 5;

export default function ShowGenerator({ videos, allLibraryVideos, selectedVideoIds, onGoToLibrary }) {
  const selectedVideos = videos.filter((v) => selectedVideoIds.includes(v.id));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  // Show content
  const [title, setTitle] = useState('');
  const [thumbnailDescription, setThumbnailDescription] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [thesis, setThesis] = useState('');
  const [counterArgument, setCounterArgument] = useState('');
  const [narrativeArc, setNarrativeArc] = useState('');
  const [whyNow, setWhyNow] = useState('');
  const [suggestedDataPoints, setSuggestedDataPoints] = useState([]);
  const [checkedDataPoints, setCheckedDataPoints] = useState([]);

  // Locks
  const [lockedElements, setLockedElements] = useState({
    title: false,
    thumbnail: false,
    synopsis: false,
  });

  // Versions
  const [versions, setVersions] = useState([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  // Editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingThumbnail, setEditingThumbnail] = useState(false);
  const [editingSynopsis, setEditingSynopsis] = useState(false);

  // Style config
  const [styleConfigOpen, setStyleConfigOpen] = useState(false);
  const hasCustomStyle = !!localStorage.getItem('videointel_style_prompt');

  // Build all data points from selected videos with verification info
  const allDataPoints = selectedVideos.flatMap((v) =>
    (v.analysis?.dataPoints || []).map((dp) => ({
      ...dp,
      videoTitle: v.videoMeta?.title || 'Unknown',
    }))
  );

  const saveCurrentVersion = useCallback(() => {
    const version = {
      title,
      thumbnailDescription,
      synopsis,
      thesis,
      counterArgument,
      narrativeArc,
      whyNow,
      suggestedDataPoints: [...suggestedDataPoints],
      checkedDataPoints: [...checkedDataPoints],
      timestamp: new Date().toISOString(),
    };

    setVersions((prev) => {
      const updated = [...prev.slice(0, currentVersionIndex + 1), version];
      if (updated.length > MAX_VERSIONS) {
        return updated.slice(updated.length - MAX_VERSIONS);
      }
      return updated;
    });
    setCurrentVersionIndex((prev) => Math.min(prev + 1, MAX_VERSIONS - 1));
  }, [title, thumbnailDescription, synopsis, thesis, counterArgument, narrativeArc, whyNow, suggestedDataPoints, checkedDataPoints, currentVersionIndex]);

  const loadVersion = useCallback((index) => {
    const version = versions[index];
    if (!version) return;
    setTitle(version.title);
    setThumbnailDescription(version.thumbnailDescription);
    setSynopsis(version.synopsis);
    setThesis(version.thesis || '');
    setCounterArgument(version.counterArgument || '');
    setNarrativeArc(version.narrativeArc || '');
    setWhyNow(version.whyNow || '');
    setSuggestedDataPoints(version.suggestedDataPoints);
    setCheckedDataPoints(version.checkedDataPoints);
    setCurrentVersionIndex(index);
  }, [versions]);

  const handleGenerate = useCallback(async (regenerateOnly = false) => {
    if (selectedVideos.length === 0) return;

    setLoading(true);
    setError('');

    // Save current state if regenerating
    if (regenerateOnly && generated) {
      saveCurrentVersion();
    }

    try {
      const stylePrompt = localStorage.getItem('videointel_style_prompt') || null;
      const libraryContext = buildLibraryContext(allLibraryVideos || []);

      const res = await apiFetch('/api/generate-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: selectedVideos.map((v) => ({
            videoMeta: v.videoMeta,
            analysis: v.analysis,
          })),
          lockedElements: regenerateOnly ? lockedElements : {},
          checkedDataPoints: regenerateOnly ? checkedDataPoints : allDataPoints.map((dp) => dp.id),
          currentContent: regenerateOnly
            ? { title, thumbnailDescription, synopsis }
            : {},
          stylePrompt,
          libraryContext,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate show concept');
      }

      const data = await res.json();

      if (!regenerateOnly || !lockedElements.title) setTitle(data.title || '');
      if (!regenerateOnly || !lockedElements.thumbnail) setThumbnailDescription(data.thumbnailDescription || '');
      if (!regenerateOnly || !lockedElements.synopsis) setSynopsis(data.synopsis || '');
      setThesis(data.thesis || '');
      setCounterArgument(data.counterArgument || '');
      setNarrativeArc(data.narrativeArc || '');
      setWhyNow(data.whyNow || '');

      const newSuggested = (data.suggestedDataPoints || []).map((sdp, i) => ({
        ...sdp,
        id: sdp.dataPointId || `sdp-${i}`,
      }));
      setSuggestedDataPoints(newSuggested);

      if (!regenerateOnly) {
        setCheckedDataPoints(newSuggested.map((sdp) => sdp.id));
        const firstVersion = {
          title: data.title || '',
          thumbnailDescription: data.thumbnailDescription || '',
          synopsis: data.synopsis || '',
          thesis: data.thesis || '',
          counterArgument: data.counterArgument || '',
          narrativeArc: data.narrativeArc || '',
          whyNow: data.whyNow || '',
          suggestedDataPoints: newSuggested,
          checkedDataPoints: newSuggested.map((sdp) => sdp.id),
          timestamp: new Date().toISOString(),
        };
        setVersions([firstVersion]);
        setCurrentVersionIndex(0);
      }

      setGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedVideos, lockedElements, checkedDataPoints, title, thumbnailDescription, synopsis, allDataPoints, generated, saveCurrentVersion]);

  const toggleLock = (key) => {
    setLockedElements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDataPoint = (id) => {
    setCheckedDataPoints((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Generate on first load if videos are selected
  useEffect(() => {
    if (selectedVideos.length > 0 && !generated && !loading) {
      handleGenerate(false);
    }
  }, [selectedVideoIds.length]); // eslint-disable-line

  if (selectedVideos.length === 0) {
    return (
      <div className="empty-state">
        <h3>No videos selected</h3>
        <p>Select videos from your Library to generate a show concept.</p>
        <button className="btn btn-primary" onClick={onGoToLibrary} style={{ marginTop: 16 }}>
          Go to Library
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Style DNA + Source Videos header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4>Source Videos</h4>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setStyleConfigOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {hasCustomStyle ? '\u2713 ' : ''}Style DNA
        </button>
      </div>

      {/* Selected videos */}
      <div style={{ marginBottom: 24 }}>
        <div className="selected-pills">
          {selectedVideos.map((v) => (
            <span key={v.id} className="video-pill">
              {v.videoMeta?.title || 'Untitled'}
            </span>
          ))}
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onGoToLibrary}>
          Add more from Library
        </button>
      </div>

      <StyleConfig isOpen={styleConfigOpen} onClose={() => setStyleConfigOpen(false)} />

      {/* Error */}
      {error && (
        <div className="message message-error" style={{ marginBottom: 24 }}>
          {error}
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleGenerate(false)}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 40, marginBottom: 24 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Generating show concept...</p>
        </div>
      )}

      {/* Generated content */}
      {generated && !loading && (
        <div>
          {/* Version nav */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <VersionNavigator
              currentVersion={currentVersionIndex + 1}
              totalVersions={versions.length}
              onNavigate={(v) => loadVersion(v - 1)}
            />
          </div>

          {/* Title */}
          <LockableElement
            label="Title"
            locked={lockedElements.title}
            onToggleLock={() => toggleLock('title')}
            onRegenerate={() => handleGenerate(true)}
            regenerating={loading}
          >
            {editingTitle ? (
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                autoFocus
                style={{ fontFamily: 'Georgia, serif', fontSize: '1.5rem', fontWeight: 700 }}
              />
            ) : (
              <h2
                className="editable-text"
                onClick={() => setEditingTitle(true)}
                style={{ cursor: 'text' }}
              >
                {title || 'Click to edit title...'}
              </h2>
            )}
          </LockableElement>

          {/* Thesis */}
          {thesis && (
            <div className="show-section">
              <span className="show-section-label">Thesis</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.6, marginTop: 8, color: 'var(--text-primary)' }}>
                {thesis}
              </p>
            </div>
          )}

          {/* Why Now */}
          {whyNow && (
            <div className="show-section" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 20 }}>
              <span className="show-section-label">Why This Week</span>
              <p style={{ lineHeight: 1.6, marginTop: 8 }}>
                {whyNow}
              </p>
            </div>
          )}

          {/* Synopsis */}
          <LockableElement
            label="Synopsis"
            locked={lockedElements.synopsis}
            onToggleLock={() => toggleLock('synopsis')}
            onRegenerate={() => handleGenerate(true)}
            regenerating={loading}
          >
            {editingSynopsis ? (
              <textarea
                className="input"
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                onBlur={() => setEditingSynopsis(false)}
                rows={8}
              />
            ) : (
              <div
                className="editable-text"
                onClick={() => setEditingSynopsis(true)}
                style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
              >
                {synopsis || 'Click to edit synopsis...'}
              </div>
            )}
          </LockableElement>

          {/* Counter-Argument (Stress Test) */}
          {counterArgument && (
            <div className="show-section" style={{ borderLeft: '3px solid var(--warning)', paddingLeft: 20 }}>
              <span className="show-section-label" style={{ color: '#8A6900' }}>Stress Test / Counter-Argument</span>
              <p style={{ lineHeight: 1.7, marginTop: 8 }}>
                {counterArgument}
              </p>
            </div>
          )}

          {/* Narrative Arc */}
          {narrativeArc && (
            <ExpandableSection title="Narrative Arc" defaultOpen={false}>
              <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {narrativeArc}
              </div>
            </ExpandableSection>
          )}

          {/* Thumbnail Description */}
          <LockableElement
            label="Thumbnail Description"
            locked={lockedElements.thumbnail}
            onToggleLock={() => toggleLock('thumbnail')}
            onRegenerate={() => handleGenerate(true)}
            regenerating={loading}
          >
            {editingThumbnail ? (
              <textarea
                className="input"
                value={thumbnailDescription}
                onChange={(e) => setThumbnailDescription(e.target.value)}
                onBlur={() => setEditingThumbnail(false)}
                rows={4}
              />
            ) : (
              <p
                className="editable-text"
                onClick={() => setEditingThumbnail(true)}
                style={{ lineHeight: 1.7 }}
              >
                {thumbnailDescription || 'Click to edit thumbnail description...'}
              </p>
            )}
          </LockableElement>

          {/* Data Points */}
          <div className="show-section">
            <span className="show-section-label">Evidence / Data Points for the Show</span>
            <div style={{ marginTop: 8 }}>
              {suggestedDataPoints.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No data points suggested.
                </p>
              ) : (
                suggestedDataPoints.map((sdp) => {
                  const checked = checkedDataPoints.includes(sdp.id);
                  const originalDp = allDataPoints.find(
                    (dp) => dp.id === sdp.dataPointId || dp.claim === sdp.claim
                  );
                  const verificationStatus = originalDp?.verification?.verified || null;

                  return (
                    <div key={sdp.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDataPoint(sdp.id)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{sdp.claim}</span>
                          {verificationStatus && (
                            <VerificationBadge status={verificationStatus} size="small" />
                          )}
                        </div>
                        {sdp.usageNote && (
                          <p
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--text-secondary)',
                              marginTop: 4,
                              fontStyle: 'italic',
                            }}
                          >
                            How to present: {sdp.usageNote}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Regenerate button */}
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleGenerate(true)}
              disabled={loading}
              style={{ padding: '14px 40px', fontSize: '1.05rem' }}
            >
              {loading ? 'Regenerating...' : 'Regenerate Unlocked Elements'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

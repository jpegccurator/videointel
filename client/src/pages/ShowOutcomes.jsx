import { useState, useEffect, useCallback } from 'react';
import { getAllShowOutcomes, deleteShowOutcome, saveShowOutcome, getYouTubeSettings } from '../utils/db';
import { useYouTubeSync } from '../hooks/useYouTubeSync';
import { extractVideoId } from '../utils/youtube';

const STATUS_COLORS = {
  draft: '#6b7280',
  published: '#3b82f6',
  matched: '#22c55e',
};

const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  matched: 'Matched',
};

export default function ShowOutcomes() {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchingId, setMatchingId] = useState(null);
  const [matchUrl, setMatchUrl] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [hasYouTube, setHasYouTube] = useState(false);

  const { syncing, syncResult, syncError, syncPerformance, canSync, clearSyncMessages } = useYouTubeSync();

  const loadOutcomes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllShowOutcomes();
      setOutcomes(data);
    } catch (e) {
      console.error('Failed to load outcomes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutcomes();
    getYouTubeSettings().then((s) => {
      setHasYouTube(!!(s && s.googleApiKey && (s.playlistUrl || s.channelUrl)));
    });
  }, [loadOutcomes]);

  // Reload after sync completes
  useEffect(() => {
    if (syncResult) loadOutcomes();
  }, [syncResult, loadOutcomes]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this show outcome?')) return;
    await deleteShowOutcome(id);
    setOutcomes((prev) => prev.filter((o) => o.id !== id));
  };

  const handleManualMatch = async (outcome) => {
    const videoId = extractVideoId(matchUrl);
    if (!videoId) {
      alert('Could not extract a video ID from that URL. Try a youtube.com/watch?v=... URL.');
      return;
    }

    await saveShowOutcome({
      ...outcome,
      status: 'matched',
      youtubeVideoId: videoId,
    });

    setMatchingId(null);
    setMatchUrl('');
    loadOutcomes();
  };

  const formatNumber = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading outcomes...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Show Outcomes</h3>
        {hasYouTube ? (
          <button
            className="btn btn-primary"
            onClick={async () => {
              clearSyncMessages();
              await syncPerformance();
            }}
            disabled={!canSync || syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {syncing ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Syncing...
              </>
            ) : (
              'Sync with YouTube'
            )}
          </button>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Add a Google API key in Settings to sync with YouTube
          </span>
        )}
      </div>

      {/* Sync feedback */}
      {syncResult && (
        <div className="message message-success" style={{ marginBottom: 16 }}>
          Sync complete: {syncResult.matched} new match{syncResult.matched !== 1 ? 'es' : ''}, {syncResult.updated} updated out of {syncResult.total} total outcomes.
        </div>
      )}
      {syncError && (
        <div className="message message-error" style={{ marginBottom: 16 }}>
          {syncError}
        </div>
      )}

      {outcomes.length === 0 ? (
        <div className="empty-state">
          <h3>No saved outcomes yet</h3>
          <p>Generate a show concept and click "Save Show Concept" to start tracking outcomes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {outcomes.map((outcome) => {
            const title = outcome.finalContent?.title || outcome.concept?.title || 'Untitled';
            const status = outcome.status || 'draft';
            const perf = outcome.performance;
            const isExpanded = expandedId === outcome.id;

            return (
              <div key={outcome.id} className="card" style={{ padding: 20 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: STATUS_COLORS[status] || '#6b7280',
                        }}
                      >
                        {STATUS_LABELS[status] || status}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(outcome.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4
                      style={{ margin: 0, cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : outcome.id)}
                    >
                      {title}
                    </h4>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleDelete(outcome.id)}
                    style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>

                {/* Performance stats (if matched) */}
                {perf && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      marginTop: 14,
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-secondary, #1a1a1a)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatNumber(perf.viewCount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Views</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatNumber(perf.likeCount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Likes</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatNumber(perf.commentCount)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Comments</div>
                    </div>
                    {outcome.youtubeVideoId && (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                        <a
                          href={`https://youtube.com/watch?v=${outcome.youtubeVideoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: 'var(--accent)' }}
                        >
                          View on YouTube
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual match */}
                {matchingId !== outcome.id && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => { setMatchingId(outcome.id); setMatchUrl(''); }}
                    style={{ marginTop: 12 }}
                  >
                    {status === 'matched' ? 'Change YouTube Match' : 'Manual Match to YouTube'}
                  </button>
                )}

                {matchingId === outcome.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      className="input"
                      type="text"
                      placeholder="Paste YouTube video URL..."
                      value={matchUrl}
                      onChange={(e) => setMatchUrl(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleManualMatch(outcome)}
                      disabled={!matchUrl.trim()}
                    >
                      Match
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setMatchingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border, #333)' }}>
                    {outcome.finalContent?.synopsis && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Synopsis</span>
                        <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 4 }}>
                          {outcome.finalContent.synopsis}
                        </p>
                      </div>
                    )}
                    {outcome.finalContent?.thesis && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Thesis</span>
                        <p style={{ lineHeight: 1.6, marginTop: 4, fontWeight: 600 }}>
                          {outcome.finalContent.thesis}
                        </p>
                      </div>
                    )}
                    {outcome.sourceVideoIds?.length > 0 && (
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Source Videos</span>
                        <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {outcome.sourceVideoIds.length} video{outcome.sourceVideoIds.length !== 1 ? 's' : ''} used
                        </p>
                      </div>
                    )}

                    {/* Performance history */}
                    {outcome.performanceHistory?.length > 1 && (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Performance History</span>
                        <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {outcome.performanceHistory.map((ph, i) => (
                            <div key={i} style={{ display: 'flex', gap: 16, padding: '4px 0' }}>
                              <span>{new Date(ph.timestamp).toLocaleDateString()}</span>
                              <span>{formatNumber(ph.viewCount)} views</span>
                              <span>{formatNumber(ph.likeCount)} likes</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

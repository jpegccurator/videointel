import { useState, useEffect, useCallback } from 'react';
import { getAllShowOutcomes, deleteShowOutcome } from '../utils/db';

export default function ShowOutcomes() {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

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
  }, [loadOutcomes]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this show outcome?')) return;
    await deleteShowOutcome(id);
    setOutcomes((prev) => prev.filter((o) => o.id !== id));
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
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Show Outcomes</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Saved show concepts and editorial decisions. The AI learns from these patterns when generating new shows.
        </p>
      </div>

      {outcomes.length === 0 ? (
        <div className="empty-state">
          <h3>No saved outcomes yet</h3>
          <p>Generate a show concept and click "Save Show Concept" to start tracking what you keep vs change.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {outcomes.map((outcome) => {
            const aiTitle = outcome.concept?.title || '';
            const finalTitle = outcome.finalContent?.title || aiTitle || 'Untitled';
            const titleEdited = aiTitle && finalTitle !== aiTitle;
            const isExpanded = expandedId === outcome.id;

            return (
              <div key={outcome.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(outcome.createdAt).toLocaleDateString()}
                    </span>
                    <h4
                      style={{ margin: '4px 0 0', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : outcome.id)}
                    >
                      {finalTitle}
                    </h4>
                    {titleEdited && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                        AI suggested: "{aiTitle}"
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleDelete(outcome.id)}
                    style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border, #333)' }}>
                    {outcome.finalContent?.thesis && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Thesis</span>
                        <p style={{ lineHeight: 1.6, marginTop: 4, fontWeight: 600 }}>
                          {outcome.finalContent.thesis}
                        </p>
                      </div>
                    )}
                    {outcome.finalContent?.synopsis && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Synopsis</span>
                        <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 4 }}>
                          {outcome.finalContent.synopsis}
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

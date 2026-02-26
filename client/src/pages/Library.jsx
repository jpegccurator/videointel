import { useState, useMemo } from 'react';
import ExpandableSection from '../components/ExpandableSection';
import DataPointCard from '../components/DataPointCard';
import VerificationBadge from '../components/VerificationBadge';

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Library({ videos, loading, onDelete, selectedIds, onToggleSelect, onGenerateShow }) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Collect all tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    videos.forEach((v) => {
      v.analysis?.topicTags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [videos]);

  // Filter videos
  const filtered = useMemo(() => {
    let list = videos;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => {
        const title = (v.videoMeta?.title || '').toLowerCase();
        const tags = (v.analysis?.topicTags || []).join(' ').toLowerCase();
        const claims = (v.analysis?.dataPoints || []).map((dp) => dp.claim).join(' ').toLowerCase();
        return title.includes(q) || tags.includes(q) || claims.includes(q);
      });
    }

    if (activeTag) {
      list = list.filter((v) => v.analysis?.topicTags?.includes(activeTag));
    }

    return list;
  }, [videos, search, activeTag]);

  const handleDelete = (id) => {
    onDelete(id);
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="search-bar">
        <input
          className="input"
          placeholder="Search videos, tags, or data points..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="chip-row">
          <span
            className={`tag tag-clickable ${!activeTag ? 'tag-active' : ''}`}
            onClick={() => setActiveTag(null)}
          >
            All
          </span>
          {allTags.map((tag) => (
            <span
              key={tag}
              className={`tag tag-clickable ${activeTag === tag ? 'tag-active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Video cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{videos.length === 0 ? 'No videos in your library' : 'No videos match your search'}</h3>
          <p>
            {videos.length === 0
              ? 'Analyze a YouTube video and save it to build your library.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="video-cards-grid">
          {filtered.map((video) => {
            const dp = video.analysis?.dataPoints || [];
            const verified = dp.filter((d) => d.verification?.verified === 'true').length;
            const unverified = dp.filter((d) => d.verification?.verified === 'false').length;
            const isExpanded = expandedId === video.id;
            const isSelected = selectedIds.includes(video.id);

            return (
              <div key={video.id} className="library-card" style={isExpanded ? { gridColumn: '1 / -1' } : {}}>
                <div className="library-card-header">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(video.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      className="library-card-title"
                      onClick={() => setExpandedId(isExpanded ? null : video.id)}
                    >
                      {video.videoMeta?.title || 'Untitled'}
                    </div>
                    <div className="library-card-meta">
                      {video.videoMeta?.channel} &middot;{' '}
                      {new Date(video.dateAnalyzed).toLocaleDateString()}
                      {video.videoMeta?.duration > 0 &&
                        ` \u00B7 ${formatDuration(video.videoMeta.duration)}`}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {video.analysis?.topicTags?.length > 0 && (
                  <div className="library-card-tags">
                    {video.analysis.topicTags.slice(0, 6).map((tag, i) => (
                      <span key={i} className="tag" style={{ fontSize: '0.7rem' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="library-card-stats">
                  {dp.length} data points &middot;{' '}
                  <span style={{ color: 'var(--verified)' }}>{verified} verified</span> &middot;{' '}
                  <span style={{ color: 'var(--unverified)' }}>{unverified} unverified</span>
                </div>

                {/* Delete */}
                <div className="library-card-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setConfirmDelete(video.id)}
                  >
                    Delete
                  </button>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <p className="video-summary" style={{ marginBottom: 20 }}>
                      {video.analysis?.oneLine}
                    </p>

                    {/* Stats row */}
                    {dp.filter((d) => d.verification?.verified === 'true').length > 0 && (
                      <div className="stats-row">
                        {dp
                          .filter((d) => d.verification?.verified === 'true')
                          .slice(0, 5)
                          .map((d) => (
                            <div key={d.id} className="stat-card">
                              <div className="stat-label">{d.metric}</div>
                              <div className="stat-value">{d.value}</div>
                              <div className="stat-badge">
                                <VerificationBadge status="true" size="small" />
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    <ExpandableSection title="Key Takeaways" defaultOpen={true}>
                      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(video.analysis?.keyTakeaways || []).map((item, i) => (
                          <li key={i} style={{ lineHeight: 1.6 }}>{item}</li>
                        ))}
                      </ul>
                    </ExpandableSection>

                    <ExpandableSection title="Data Points" defaultOpen={true} count={dp.length}>
                      <div className="data-points-grid">
                        {dp.map((d) => (
                          <DataPointCard key={d.id} dataPoint={d} />
                        ))}
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Deeper Analysis" defaultOpen={false}>
                      <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                        {video.analysis?.deeperAnalysis}
                      </div>
                    </ExpandableSection>

                    <ExpandableSection title="Full Transcript" defaultOpen={false}>
                      <div className="transcript-text">{video.transcript}</div>
                    </ExpandableSection>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.length} video{selectedIds.length > 1 ? 's' : ''} selected</span>
          <button className="btn btn-primary" onClick={onGenerateShow}>
            Generate Show from {selectedIds.length} selected video{selectedIds.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Video</h3>
            <p>Are you sure you want to remove this video from your library? This cannot be undone.</p>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

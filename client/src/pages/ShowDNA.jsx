import { useState, useCallback, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ExpandableSection from '../components/ExpandableSection';
import { apiFetch } from '../utils/api';
import {
  savePlaylistDNA,
  getPlaylistDNAByUrl,
  saveYoutubePlaylistUrl,
  getYoutubePlaylistUrl,
} from '../utils/db';
import { v4 as uuidv4 } from 'uuid';

function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ flex: '1 1 140px', padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ShowDNA({ hasApiKey, onNeedSettings }) {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [dnaRecord, setDnaRecord] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, videoTitle: '', skipped: 0 });
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  // Load persisted URL and cached data on mount
  useEffect(() => {
    (async () => {
      const savedUrl = await getYoutubePlaylistUrl();
      if (savedUrl) {
        setPlaylistUrl(savedUrl);
        const cached = await getPlaylistDNAByUrl(savedUrl);
        if (cached) setDnaRecord(cached);
      }
    })();
  }, []);

  const handleScan = useCallback(async () => {
    if (!playlistUrl.trim()) return;
    if (!hasApiKey) { onNeedSettings(); return; }

    setProcessing(true);
    setError('');
    setPhase('fetching');
    setProgress({ current: 0, total: 0, videoTitle: '', skipped: 0 });

    // Persist the URL
    await saveYoutubePlaylistUrl(playlistUrl.trim());

    // Get already-analyzed video IDs from cache
    const cached = await getPlaylistDNAByUrl(playlistUrl.trim());
    const alreadyAnalyzedIds = cached?.videos
      ?.filter((v) => v.dnaAnalysis)
      .map((v) => v.videoId) || [];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await apiFetch('/api/playlist-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: playlistUrl.trim(), alreadyAnalyzedIds }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track newly analyzed results
      const newResults = [];
      let allVideos = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.phase === 'fetching') {
              setPhase('fetching');
            } else if (event.phase === 'fetched') {
              setProgress((p) => ({ ...p, total: event.totalVideos }));
            } else if (event.phase === 'analyzing') {
              setPhase('analyzing');
              setProgress((p) => ({
                ...p,
                total: event.toAnalyze,
                skipped: event.skipped,
              }));
            } else if (event.phase === 'analyzing-video') {
              setProgress((p) => ({
                ...p,
                current: event.current,
                total: event.total,
                videoTitle: event.videoTitle,
              }));
            } else if (event.phase === 'video-complete') {
              newResults.push({
                videoId: event.videoId,
                dnaAnalysis: event.dnaAnalysis,
              });
              setProgress((p) => ({
                ...p,
                current: event.current,
              }));
            } else if (event.phase === 'video-skipped' || event.phase === 'video-error') {
              setProgress((p) => ({ ...p, current: event.current }));
            } else if (event.phase === 'complete') {
              allVideos = event.videos || [];

              // Merge cached DNA with new results
              const dnaMap = {};
              // Start with cached
              if (cached?.videos) {
                for (const v of cached.videos) {
                  if (v.dnaAnalysis) dnaMap[v.videoId] = v.dnaAnalysis;
                }
              }
              // Overlay new
              for (const r of (event.analyzedResults || [])) {
                dnaMap[r.videoId] = r.dnaAnalysis;
              }

              const mergedVideos = allVideos.map((v) => ({
                ...v,
                dnaAnalysis: dnaMap[v.videoId] || null,
              }));

              // Phase 3: Synthesize insights
              setPhase('synthesizing');
              const videosForSynthesis = mergedVideos
                .filter((v) => v.dnaAnalysis)
                .map((v) => ({
                  title: v.title,
                  viewCount: v.viewCount,
                  likeCount: v.likeCount,
                  duration: v.duration,
                  uploadDate: v.uploadDate,
                  dnaAnalysis: v.dnaAnalysis,
                }));

              let insights = null;
              if (videosForSynthesis.length >= 3) {
                const synthRes = await apiFetch('/api/playlist-dna/synthesize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ videosWithDNA: videosForSynthesis }),
                });
                if (synthRes.ok) {
                  const synthData = await synthRes.json();
                  insights = synthData.insights;
                }
              }

              // Save to IndexedDB
              const record = await savePlaylistDNA({
                id: cached?.id || uuidv4(),
                playlistUrl: playlistUrl.trim(),
                lastFetched: new Date().toISOString(),
                videos: mergedVideos,
                insights,
              });

              setDnaRecord(record);
              setPhase('done');
            } else if (event.phase === 'error') {
              setError(event.message);
              setPhase('');
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }, [playlistUrl, hasApiKey, onNeedSettings]);

  const insights = dnaRecord?.insights;
  const hasDashboard = insights && !processing;

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Show DNA</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
        Deep-analyze your entire playlist to understand what content performs best and why.
      </p>

      {/* Playlist URL input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className="input"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="YouTube playlist URL..."
          style={{ flex: 1 }}
          disabled={processing}
        />
        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={processing || !playlistUrl.trim()}
        >
          {processing ? 'Scanning...' : dnaRecord ? 'Rescan' : 'Scan Playlist'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="message message-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Processing */}
      {processing && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          {phase === 'fetching' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="spinner" />
              <span>Fetching playlist metadata...</span>
            </div>
          )}

          {phase === 'analyzing' && progress.total === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="spinner" />
              <span>Preparing analysis...</span>
            </div>
          )}

          {(phase === 'analyzing' || phase === 'analyzing-video' || phase === 'video-complete') && progress.total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Analyzing videos</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {progress.current}/{progress.total}
                  {progress.skipped > 0 && ` (${progress.skipped} cached)`}
                </span>
              </div>
              <div style={{
                height: 8,
                background: 'var(--border)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 12,
              }}>
                <div style={{
                  height: '100%',
                  width: `${(progress.current / progress.total) * 100}%`,
                  background: 'var(--accent)',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {progress.videoTitle && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {progress.videoTitle}
                </p>
              )}
            </div>
          )}

          {phase === 'synthesizing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="spinner" />
              <span>Generating insights from {dnaRecord?.videos?.filter((v) => v.dnaAnalysis).length || '...'} analyzed videos...</span>
            </div>
          )}
        </div>
      )}

      {/* Dashboard */}
      {hasDashboard && (
        <div>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard label="Total Videos" value={insights.overallStats?.totalVideos || 0} />
            <StatCard label="Avg Views" value={formatViews(insights.overallStats?.avgViews || 0)} />
            <StatCard label="Median Views" value={formatViews(insights.overallStats?.medianViews || 0)} />
            <StatCard
              label="Optimal Duration"
              value={insights.optimalDuration?.maxSeconds > 0
                ? `${Math.round(insights.optimalDuration.minSeconds / 60)}-${Math.round(insights.optimalDuration.maxSeconds / 60)}m`
                : 'N/A'}
              sub={insights.optimalDuration?.avgViewsInRange > 0
                ? `${formatViews(insights.optimalDuration.avgViewsInRange)} avg views`
                : null}
            />
          </div>

          {/* Views Over Time */}
          {insights.viewsTrend?.length > 1 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 16 }}>Views Over Time</h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={insights.viewsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tickFormatter={formatViews} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip formatter={(v) => [formatViews(v), 'Avg Views']} />
                  <Line type="monotone" dataKey="avgViews" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Performance by Topic */}
          {insights.topTopics?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 16 }}>Performance by Topic</h4>
              <ResponsiveContainer width="100%" height={Math.max(200, insights.topTopics.length * 36)}>
                <BarChart data={insights.topTopics} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={formatViews} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis dataKey="topic" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={110} />
                  <Tooltip formatter={(v) => [formatViews(v), 'Avg Views']} />
                  <Bar dataKey="avgViews" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Topics to Avoid */}
          {insights.worstTopics?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Topics to Avoid</h4>
              <div>
                {insights.worstTopics.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i < insights.worstTopics.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontWeight: 500 }}>{t.topic}</span>
                    <span style={{ color: 'var(--unverified)', fontSize: '0.9rem' }}>
                      {formatViews(t.avgViews)} avg ({t.count} videos)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Title Patterns */}
          {insights.titlePatterns?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Title Patterns That Work</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.titlePatterns.map((p, i) => (
                  <div key={i} style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{p.pattern}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}>
                        {formatViews(p.avgViews)} avg
                      </span>
                    </div>
                    {p.examples?.length > 0 && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {p.examples.slice(0, 3).map((ex, j) => (
                          <div key={j} style={{ marginTop: 2 }}>&ldquo;{ex}&rdquo;</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format Breakdown */}
          {insights.formatBreakdown?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 16 }}>Format Breakdown</h4>
              <ResponsiveContainer width="100%" height={Math.max(180, insights.formatBreakdown.length * 36)}>
                <BarChart data={insights.formatBreakdown} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={formatViews} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis dataKey="format" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={90} />
                  <Tooltip formatter={(v) => [formatViews(v), 'Avg Views']} />
                  <Bar dataKey="avgViews" fill="#095E66" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Actionable Insights */}
          {insights.actionableInsights?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Actionable Insights</h4>
              <ol style={{ paddingLeft: 20 }}>
                {insights.actionableInsights.map((insight, i) => (
                  <li key={i} style={{ marginBottom: 10, lineHeight: 1.6, fontSize: '0.95rem' }}>
                    {insight}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* All Videos table */}
          <ExpandableSection
            title="All Videos"
            defaultOpen={false}
            count={`${dnaRecord.videos?.length || 0} videos`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Title</th>
                    <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Views</th>
                    <th style={{ padding: '8px 12px' }}>Topic</th>
                    <th style={{ padding: '8px 12px' }}>Format</th>
                    <th style={{ padding: '8px 12px' }}>Tone</th>
                    <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(dnaRecord.videos || [])]
                    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
                    .map((v, i) => (
                      <tr key={v.videoId || i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.title}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          {formatViews(v.viewCount || 0)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {v.dnaAnalysis?.topic || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {v.dnaAnalysis?.formatTags?.join(', ') || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {v.dnaAnalysis?.tone || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {v.duration ? formatDuration(v.duration) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </ExpandableSection>

          {/* Last updated */}
          {dnaRecord.lastFetched && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
              Last scanned: {new Date(dnaRecord.lastFetched).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Empty state when we have cached data but no insights */}
      {dnaRecord && !insights && !processing && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            {dnaRecord.videos?.filter((v) => v.dnaAnalysis).length || 0} videos analyzed but not enough data for insights.
            Need at least 3 analyzed videos. Click "Rescan" to analyze more.
          </p>
        </div>
      )}
    </div>
  );
}

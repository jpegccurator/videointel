import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ExpandableSection from '../components/ExpandableSection';
import DataPointCard from '../components/DataPointCard';
import VerificationBadge from '../components/VerificationBadge';
import { apiFetch } from '../utils/api';

const PROGRESS_LABELS = {
  1: 'Fetching transcript...',
  2: 'Extracting data points...',
  3: 'Verifying statistics...',
  4: 'Building dashboard...',
};

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

// ── Result dashboard for a completed job ────────────────────────────
function JobResult({ result }) {
  const topDataPoints = result?.analysis?.dataPoints
    ?.filter((dp) => dp.verification?.verified === 'true')
    .slice(0, 5) || [];

  const allDataPoints = result?.analysis?.dataPoints || [];
  const verifiedCount = allDataPoints.filter((dp) => dp.verification?.verified === 'true').length;
  const partialCount = allDataPoints.filter((dp) => dp.verification?.verified === 'partial').length;
  const unverifiedCount = allDataPoints.filter((dp) => dp.verification?.verified === 'false').length;

  return (
    <div>
      {/* Key Stats Row */}
      {topDataPoints.length > 0 && (
        <div className="stats-row">
          {topDataPoints.map((dp) => (
            <div key={dp.id} className="stat-card">
              <div className="stat-label">{dp.metric}</div>
              <div className="stat-value">{dp.value}</div>
              <div className="stat-badge">
                <VerificationBadge status={dp.verification?.verified || 'false'} size="small" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 24,
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          <strong>{allDataPoints.length}</strong> data points
        </span>
        <span style={{ color: 'var(--verified)' }}>
          <strong>{verifiedCount}</strong> verified
        </span>
        {partialCount > 0 && (
          <span style={{ color: 'var(--warning)' }}>
            <strong>{partialCount}</strong> partial
          </span>
        )}
        <span style={{ color: 'var(--unverified)' }}>
          <strong>{unverifiedCount}</strong> unverified
        </span>
      </div>

      {/* Key Takeaways */}
      <ExpandableSection title="Key Takeaways" defaultOpen={true}>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {result.analysis.keyTakeaways.map((item, i) => (
            <li key={i} style={{ lineHeight: 1.6 }}>
              {item}
            </li>
          ))}
        </ul>
      </ExpandableSection>

      {/* Data Points */}
      <ExpandableSection
        title="Data Points Deep Dive"
        defaultOpen={true}
        count={allDataPoints.length}
      >
        <div className="data-points-grid">
          {allDataPoints.map((dp) => (
            <DataPointCard key={dp.id} dataPoint={dp} />
          ))}
        </div>
      </ExpandableSection>

      {/* Deeper Analysis */}
      <ExpandableSection title="Deeper Analysis" defaultOpen={false}>
        <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {result.analysis.deeperAnalysis}
        </div>
      </ExpandableSection>

      {/* Full Transcript */}
      <ExpandableSection title="Full Transcript" defaultOpen={false}>
        <div className="transcript-text">{result.transcript}</div>
      </ExpandableSection>

      {/* Topic Tags */}
      {result.analysis.topicTags?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.analysis.topicTags.map((tag, i) => (
              <span key={i} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function Analyze({ onSaveToLibrary, hasApiKey, onNeedSettings }) {
  const [url, setUrl] = useState('');
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef(jobs);

  // Keep ref in sync so SSE callbacks see latest state
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // ── Update a single job by ID ───────────────────────────────────
  const updateJob = useCallback((id, updates) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, []);

  // ── Process a single job (SSE stream) ───────────────────────────
  const processJob = useCallback(
    async (jobId) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;

      updateJob(jobId, { status: 'analyzing', currentStep: 0, stepMessage: '' });

      try {
        const response = await apiFetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: job.url }),
        });

        // Handle non-SSE error responses (e.g. 400 JSON errors)
        if (!response.ok) {
          let errorMsg = `Server error (${response.status})`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch { /* ignore parse failure */ }
          updateJob(jobId, { status: 'error', error: errorMsg });
          return;
        }

        if (!response.body) {
          updateJob(jobId, { status: 'error', error: 'No response stream. Try refreshing the page.' });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.step === 'error') {
                  updateJob(jobId, { status: 'error', error: data.message });
                  return;
                }

                if (data.step === 'complete') {
                  updateJob(jobId, {
                    status: 'complete',
                    result: data.data,
                    currentStep: 5,
                    expanded: true,
                  });
                  return;
                }

                if (typeof data.step === 'number') {
                  updateJob(jobId, {
                    currentStep: data.step,
                    stepMessage: data.message || PROGRESS_LABELS[data.step] || '',
                  });
                }
              } catch {
                // Ignore parse errors in stream
              }
            }
          }
        }
        // Stream ended without a complete/error event — mark as error
        const finalJob = jobsRef.current.find((j) => j.id === jobId);
        if (finalJob && finalJob.status === 'analyzing') {
          updateJob(jobId, { status: 'error', error: 'Analysis stream ended unexpectedly. Try again.' });
        }
      } catch (err) {
        updateJob(jobId, {
          status: 'error',
          error: err.message || 'Failed to connect to server. Is the backend running?',
        });
      }
    },
    [updateJob],
  );

  // ── Auto-pick next queued job when nothing is analyzing ─────────
  useEffect(() => {
    const analyzing = jobs.find((j) => j.status === 'analyzing');
    if (analyzing) return;

    const nextQueued = jobs.find((j) => j.status === 'queued');
    if (nextQueued) {
      processJob(nextQueued.id);
    }
  }, [jobs, processJob]);

  // ── Add a new job ───────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!hasApiKey) {
      onNeedSettings();
      return;
    }

    const newJob = {
      id: uuidv4(),
      url: trimmed,
      status: 'queued',
      currentStep: 0,
      stepMessage: '',
      error: null,
      result: null,
      expanded: true,
    };

    setJobs((prev) => [...prev, newJob]);
    setUrl('');
  }, [url, hasApiKey, onNeedSettings]);

  // ── Remove a queued job ─────────────────────────────────────────
  const handleRemove = useCallback((id) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  // ── Retry a failed job ──────────────────────────────────────────
  const handleRetry = useCallback((id) => {
    updateJob(id, { status: 'queued', error: null, currentStep: 0, stepMessage: '' });
  }, [updateJob]);

  // ── Save a completed job to library ─────────────────────────────
  const handleSave = useCallback(
    (job) => {
      if (!job.result) return;
      const video = {
        id: uuidv4(),
        url: job.url,
        videoMeta: job.result.videoMeta,
        transcript: job.result.transcript,
        analysis: job.result.analysis,
        dateAnalyzed: new Date().toISOString(),
      };
      onSaveToLibrary(video);
      updateJob(job.id, { status: 'saved' });
    },
    [onSaveToLibrary, updateJob],
  );

  // ── Toggle expand/collapse on a completed/saved job ─────────────
  const toggleExpand = useCallback(
    (id) => {
      const job = jobs.find((j) => j.id === id);
      if (job) updateJob(id, { expanded: !job.expanded });
    },
    [jobs, updateJob],
  );

  const hasNoJobs = jobs.length === 0;

  return (
    <div>
      {/* Job cards */}
      {jobs.map((job) => (
        <div key={job.id} className="card" style={{ marginBottom: 16 }}>
          {/* ── Queued ──────────────────────────────────────── */}
          {job.status === 'queued' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Queued
                  </div>
                  <div style={{ wordBreak: 'break-all', fontSize: '0.9rem' }}>{job.url}</div>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleRemove(job.id)}
                  style={{ marginLeft: 12, flexShrink: 0 }}
                  title="Remove from queue"
                >
                  ✕
                </button>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>
                Queued — waiting for current job...
              </div>
            </div>
          )}

          {/* ── Analyzing ───────────────────────────────────── */}
          {job.status === 'analyzing' && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent, var(--primary))', letterSpacing: '0.05em', marginBottom: 8 }}>
                Analyzing
              </div>
              <div style={{ wordBreak: 'break-all', fontSize: '0.9rem', marginBottom: 16 }}>{job.url}</div>
              <div className="progress-steps">
                {[1, 2, 3, 4].map((step) => {
                  let cls = '';
                  if (step < job.currentStep) cls = 'done';
                  else if (step === job.currentStep) cls = 'active';
                  return (
                    <div key={step} className={`progress-step ${cls}`}>
                      <span className="step-icon">
                        {step < job.currentStep ? (
                          '\u2713'
                        ) : step === job.currentStep ? (
                          <span className="spinner" />
                        ) : (
                          <span style={{ color: 'var(--border)' }}>{step}</span>
                        )}
                      </span>
                      <span>{step === job.currentStep ? job.stepMessage : PROGRESS_LABELS[step]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Error ───────────────────────────────────────── */}
          {job.status === 'error' && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--unverified, #e74c3c)', letterSpacing: '0.05em', marginBottom: 4 }}>
                Error
              </div>
              <div style={{ wordBreak: 'break-all', fontSize: '0.9rem', marginBottom: 8 }}>{job.url}</div>
              <div className="message message-error" style={{ marginBottom: 12 }}>
                {job.error}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => handleRetry(job.id)}>
                Retry
              </button>
            </div>
          )}

          {/* ── Complete ────────────────────────────────────── */}
          {job.status === 'complete' && (
            <div>
              <div
                onClick={() => toggleExpand(job.id)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', transform: job.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                    &#9662;
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--verified, #27ae60)', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Complete
                    </div>
                    <h3 style={{ margin: 0 }}>{job.result.videoMeta.title}</h3>
                    <div className="video-meta-row" style={{ marginTop: 4 }}>
                      <span>{job.result.videoMeta.channel}</span>
                      <span>&middot;</span>
                      <span>{job.result.videoMeta.publishDate}</span>
                      {job.result.videoMeta.duration > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{formatDuration(job.result.videoMeta.duration)}</span>
                        </>
                      )}
                    </div>
                    <p className="video-summary" style={{ marginBottom: 0 }}>
                      {job.result.analysis.oneLine}
                    </p>
                  </div>
                </div>
              </div>

              {job.expanded && (
                <div style={{ marginTop: 20 }}>
                  <JobResult result={job.result} />
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSave(job)}
                      style={{ padding: '14px 40px', fontSize: '1.05rem' }}
                    >
                      Save to Library
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Saved ───────────────────────────────────────── */}
          {job.status === 'saved' && (
            <div>
              <div
                onClick={() => toggleExpand(job.id)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', transform: job.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                    &#9662;
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--verified, #27ae60)', letterSpacing: '0.05em' }}>
                        Complete
                      </span>
                      <span
                        className="tag"
                        style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      >
                        Saved
                      </span>
                    </div>
                    <h3 style={{ margin: 0 }}>{job.result.videoMeta.title}</h3>
                    <div className="video-meta-row" style={{ marginTop: 4 }}>
                      <span>{job.result.videoMeta.channel}</span>
                      <span>&middot;</span>
                      <span>{job.result.videoMeta.publishDate}</span>
                      {job.result.videoMeta.duration > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{formatDuration(job.result.videoMeta.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {job.expanded && (
                <div style={{ marginTop: 20 }}>
                  <JobResult result={job.result} />
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div className="message message-success" style={{ display: 'inline-block' }}>
                      Saved to Library
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Input — always active */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="input input-lg"
            placeholder="Paste a YouTube URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!url.trim()}
            style={{ padding: '16px 32px', fontSize: '1.05rem', whiteSpace: 'nowrap' }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Empty state */}
      {hasNoJobs && (
        <div className="empty-state">
          <h3>Paste a YouTube URL to get started</h3>
          <p style={{ maxWidth: 500, margin: '0 auto' }}>
            VideoIntel will transcribe the video, extract every data point and statistic, and verify
            each one against real sources.
          </p>
        </div>
      )}
    </div>
  );
}

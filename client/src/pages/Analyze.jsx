import { useState, useCallback } from 'react';
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

export default function Analyze({ onSaveToLibrary, hasApiKey, onNeedSettings }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) return;
    if (!hasApiKey) {
      onNeedSettings();
      return;
    }

    setLoading(true);
    setCurrentStep(0);
    setStepMessage('');
    setError('');
    setResult(null);
    setSaved(false);

    try {
      const response = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

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
                setError(data.message);
                setLoading(false);
                return;
              }

              if (data.step === 'complete') {
                setResult(data.data);
                setCurrentStep(5);
                setLoading(false);
                return;
              }

              if (typeof data.step === 'number') {
                setCurrentStep(data.step);
                setStepMessage(data.message || PROGRESS_LABELS[data.step] || '');
              }
            } catch {
              // Ignore parse errors in stream
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to server. Is the backend running?');
    }

    setLoading(false);
  }, [url, hasApiKey, onNeedSettings]);

  const handleSave = useCallback(() => {
    if (!result) return;
    const video = {
      id: uuidv4(),
      url: url.trim(),
      videoMeta: result.videoMeta,
      transcript: result.transcript,
      analysis: result.analysis,
      dateAnalyzed: new Date().toISOString(),
    };
    onSaveToLibrary(video);
    setSaved(true);
  }, [result, url, onSaveToLibrary]);

  const topDataPoints = result?.analysis?.dataPoints
    ?.filter((dp) => dp.verification?.verified === 'true')
    .slice(0, 5) || [];

  const allDataPoints = result?.analysis?.dataPoints || [];
  const verifiedCount = allDataPoints.filter((dp) => dp.verification?.verified === 'true').length;
  const partialCount = allDataPoints.filter((dp) => dp.verification?.verified === 'partial').length;
  const unverifiedCount = allDataPoints.filter((dp) => dp.verification?.verified === 'false').length;

  return (
    <div>
      {/* Input */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="input input-lg"
            placeholder="Paste a YouTube URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            style={{ padding: '16px 32px', fontSize: '1.05rem', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="message message-error" style={{ marginBottom: 24 }}>
          {error}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleAnalyze}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div className="card" style={{ marginBottom: 32 }}>
          <div className="progress-steps">
            {[1, 2, 3, 4].map((step) => {
              let cls = '';
              if (step < currentStep) cls = 'done';
              else if (step === currentStep) cls = 'active';
              return (
                <div key={step} className={`progress-step ${cls}`}>
                  <span className="step-icon">
                    {step < currentStep ? (
                      '\u2713'
                    ) : step === currentStep ? (
                      <span className="spinner" />
                    ) : (
                      <span style={{ color: 'var(--border)' }}>{step}</span>
                    )}
                  </span>
                  <span>{step === currentStep ? stepMessage : PROGRESS_LABELS[step]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard */}
      {result && (
        <div>
          {/* Video Header */}
          <div className="video-header">
            <h1>{result.videoMeta.title}</h1>
            <div className="video-meta-row">
              <span>{result.videoMeta.channel}</span>
              <span>&middot;</span>
              <span>{result.videoMeta.publishDate}</span>
              {result.videoMeta.duration > 0 && (
                <>
                  <span>&middot;</span>
                  <span>{formatDuration(result.videoMeta.duration)}</span>
                </>
              )}
            </div>
            <p className="video-summary">{result.analysis.oneLine}</p>
          </div>

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

          {/* Save button */}
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {saved ? (
              <div className="message message-success" style={{ display: 'inline-block' }}>
                Saved to Library
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ padding: '14px 40px', fontSize: '1.05rem' }}
              >
                Save to Library
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
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

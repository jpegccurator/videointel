import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const MODES = {
  CHOOSE: 'choose',
  ANALYZE: 'analyze',
  CUSTOM: 'custom',
  COWORK: 'cowork',
};

export default function StyleConfig({ isOpen, onClose }) {
  const [mode, setMode] = useState(MODES.CHOOSE);
  const [savedPrompt, setSavedPrompt] = useState(null);
  const [loading, setLoading] = useState(false);

  // Analyze mode
  const [channelUrl, setChannelUrl] = useState('');
  const [analyzeStep, setAnalyzeStep] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState(null);

  // Custom mode
  const [customPrompt, setCustomPrompt] = useState('');
  const [skipQuestions, setSkipQuestions] = useState(false);

  // Cowork mode
  const [coworkAnswers, setCoworkAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [progress, setProgress] = useState('');

  // Load saved prompt on open (localStorage only - no server state)
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('videointel_style_prompt');
      if (stored) {
        setSavedPrompt(stored);
        setCustomPrompt(stored);
      }
    }
  }, [isOpen]);

  const savePrompt = useCallback((prompt) => {
    localStorage.setItem('videointel_style_prompt', prompt);
    setSavedPrompt(prompt);
  }, []);

  const clearPrompt = useCallback(() => {
    localStorage.removeItem('videointel_style_prompt');
    setSavedPrompt(null);
    setCustomPrompt('');
  }, []);

  // Channel analysis
  const handleAnalyze = useCallback(async () => {
    if (!channelUrl.trim()) return;
    setLoading(true);
    setAnalyzeStep('Starting...');
    setAnalyzeResult(null);

    try {
      const response = await apiFetch('/api/analyze-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: channelUrl.trim() }),
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
                setAnalyzeStep(`Error: ${data.message}`);
                setLoading(false);
                return;
              }
              if (data.step === 'complete') {
                setAnalyzeResult(data.data.styleProfile);
                setCustomPrompt(data.data.styleProfile);
                setAnalyzeStep(`Analyzed ${data.data.videoCount} videos from ${data.data.channel}`);
                setLoading(false);
                return;
              }
              if (data.message) setAnalyzeStep(data.message);
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setAnalyzeStep(`Error: ${err.message}`);
    }
    setLoading(false);
  }, [channelUrl]);

  // Cowork mode - get next question
  const fetchNextQuestion = useCallback(async (answers) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/build-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, skipQuestions: false }),
      });
      const data = await res.json();
      if (data.error) {
        setCurrentQuestion({ question: `Error: ${data.error}`, id: 'error' });
        setLoading(false);
        return;
      }
      if (data.done) {
        setCustomPrompt(data.prompt);
        setCurrentQuestion(null);
        setMode(MODES.CUSTOM);
      } else {
        setCurrentQuestion(data);
        setProgress(data.progress);
      }
    } catch (err) {
      setCurrentQuestion({ question: `Error: ${err.message}`, id: 'error' });
    }
    setLoading(false);
  }, []);

  const startCowork = useCallback(() => {
    setMode(MODES.COWORK);
    setCoworkAnswers({});
    setCurrentAnswer('');
    fetchNextQuestion({});
  }, [fetchNextQuestion]);

  const submitAnswer = useCallback(() => {
    if (!currentAnswer.trim() || !currentQuestion) return;
    const updated = { ...coworkAnswers, [currentQuestion.questionId]: currentAnswer.trim() };
    setCoworkAnswers(updated);
    setCurrentAnswer('');
    fetchNextQuestion(updated);
  }, [currentAnswer, currentQuestion, coworkAnswers, fetchNextQuestion]);

  // Skip questions mode - just polish the raw prompt
  const handleSkipPolish = useCallback(async () => {
    if (!customPrompt.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/build-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { rawPrompt: customPrompt.trim() }, skipQuestions: true }),
      });
      const data = await res.json();
      if (data.prompt) setCustomPrompt(data.prompt);
    } catch { /* silent */ }
    setLoading(false);
  }, [customPrompt]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Show Style DNA</h2>
          {mode !== MODES.CHOOSE && (
            <button className="btn btn-sm btn-secondary" onClick={() => { setMode(MODES.CHOOSE); setLoading(false); }}>
              Back
            </button>
          )}
        </div>

        {/* Saved prompt indicator */}
        {savedPrompt && mode === MODES.CHOOSE && (
          <div className="message message-success" style={{ marginBottom: 16 }}>
            Custom style prompt is active.
            <button className="btn btn-sm btn-secondary" onClick={() => setMode(MODES.CUSTOM)} style={{ marginLeft: 8 }}>
              Edit
            </button>
            <button className="btn btn-sm btn-danger" onClick={clearPrompt} style={{ marginLeft: 8 }}>
              Reset to Base
            </button>
          </div>
        )}

        {/* === CHOOSE MODE === */}
        {mode === MODES.CHOOSE && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Configure how the Show Generator creates concepts. Use the built-in style, or teach it yours.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="card"
                onClick={() => setMode(MODES.ANALYZE)}
                style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Analyze a Channel or Playlist</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Paste a YouTube channel or playlist URL. The AI will watch 6-8 videos and extract the creator's style, structure, tone, and patterns.
                </div>
              </button>

              <button
                className="card"
                onClick={startCowork}
                style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Build with AI (Recommended)</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  The AI asks you 7 questions about your content, voice, and audience, then generates a tailored prompt. Takes about 5 minutes.
                </div>
              </button>

              <button
                className="card"
                onClick={() => setMode(MODES.CUSTOM)}
                style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Write Your Own Prompt</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Paste or write your own system prompt directly. Full control. The AI can optionally polish it for you.
                </div>
              </button>
            </div>
          </div>
        )}

        {/* === ANALYZE MODE === */}
        {mode === MODES.ANALYZE && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Paste a YouTube channel URL or playlist URL. The AI will sample videos and extract the style.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input
                className="input"
                placeholder="https://www.youtube.com/@ChannelName or playlist URL..."
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !channelUrl.trim()}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            {analyzeStep && (
              <div style={{ fontSize: '0.9rem', color: loading ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
                {analyzeStep}
              </div>
            )}

            {analyzeResult && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Generated Style Profile
                  </label>
                  <textarea
                    className="input"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={12}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => { savePrompt(customPrompt); onClose(); }}>
                    Save & Use This Style
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === COWORK MODE === */}
        {mode === MODES.COWORK && (
          <div>
            {currentQuestion && currentQuestion.id !== 'error' && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Question {progress}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.5, marginBottom: 4 }}>
                    {currentQuestion.question}
                  </p>
                  {currentQuestion.context && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      {currentQuestion.context}
                    </p>
                  )}
                </div>

                <textarea
                  className="input"
                  placeholder="Your answer..."
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  rows={4}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) submitAnswer();
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 12 }}>
                  <button className="btn btn-primary" onClick={submitAnswer} disabled={loading || !currentAnswer.trim()}>
                    {loading ? 'Processing...' : 'Next'}
                  </button>
                </div>

                {/* Show previous answers */}
                {Object.keys(coworkAnswers).length > 0 && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Your answers so far
                    </div>
                    {Object.entries(coworkAnswers).map(([key, val]) => (
                      <div key={key} style={{ fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-secondary)' }}>
                        {val.substring(0, 100)}{val.length > 100 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading && !currentQuestion && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Generating your custom prompt...</p>
              </div>
            )}
          </div>
        )}

        {/* === CUSTOM MODE === */}
        {mode === MODES.CUSTOM && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              This is the system prompt used when generating show concepts. Edit it directly or let the AI polish it.
            </p>

            <textarea
              className="input"
              placeholder="Enter your custom show generation prompt...

Example: You are generating YouTube show concepts for [Name]. The shows should be data-driven, covering [topics]. The tone should be [tone]. Structure: [how episodes flow]. Never: [anti-patterns]."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={14}
              style={{ fontSize: '0.85rem', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={handleSkipPolish}
                disabled={loading || !customPrompt.trim()}
              >
                {loading ? 'Polishing...' : 'AI Polish'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { savePrompt(customPrompt); onClose(); }}
                disabled={!customPrompt.trim()}
              >
                Save & Use
              </button>
            </div>
          </div>
        )}

        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

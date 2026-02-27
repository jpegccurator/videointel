import { useState, useEffect } from 'react';
import { getYouTubeSettings, saveYouTubeSettings } from '../utils/db';

export default function SettingsModal({ isOpen, onClose, apiKey, onSave, onTest }) {
  const [key, setKey] = useState(apiKey || '');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // YouTube settings
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytChannel, setYtChannel] = useState('');
  const [ytSaving, setYtSaving] = useState(false);
  const [ytSaved, setYtSaved] = useState(false);

  // Load YouTube settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setKey(apiKey || '');
      getYouTubeSettings().then((settings) => {
        if (settings) {
          setYtApiKey(settings.googleApiKey || '');
          setYtChannel(settings.channelUrl || '');
        }
      });
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!key.trim()) return;
    onSave(key.trim());
    setTestResult(null);
    onClose();
  };

  const handleTest = async () => {
    if (!key.trim()) return;
    setTesting(true);
    setTestResult(null);
    onSave(key.trim());
    const result = await onTest(key.trim());
    setTestResult(result);
    setTesting(false);
  };

  const handleSaveYouTube = async () => {
    setYtSaving(true);
    setYtSaved(false);
    try {
      const existing = await getYouTubeSettings();
      await saveYouTubeSettings({
        ...existing,
        googleApiKey: ytApiKey.trim(),
        channelUrl: ytChannel.trim(),
        channelId: null, // Reset so it re-resolves on next sync
      });
      setYtSaved(true);
      setTimeout(() => setYtSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save YouTube settings:', e);
    } finally {
      setYtSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        {/* OpenAI Section */}
        <p>Enter your OpenAI API key to use VideoIntel. Your key is stored locally in your browser.</p>

        <div className="form-group">
          <label htmlFor="api-key">OpenAI API Key</label>
          <input
            id="api-key"
            type="password"
            className="input"
            placeholder="sk-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {testResult && (
          <div className={`message ${testResult.success ? 'message-success' : 'message-error'}`}>
            {testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-secondary" onClick={handleTest} disabled={!key.trim() || testing}>
            {testing ? 'Testing...' : 'Test Key'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!key.trim()}>
            Save
          </button>
        </div>

        {/* YouTube Section */}
        <hr style={{ margin: '28px 0 20px', borderColor: 'var(--border, #333)' }} />

        <h3 style={{ marginBottom: 8 }}>YouTube Channel</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          Connect your YouTube channel to track show performance. Requires a free Google API key
          (YouTube Data API v3, 10k requests/day).
        </p>

        <div className="form-group">
          <label htmlFor="yt-api-key">Google API Key</label>
          <input
            id="yt-api-key"
            type="password"
            className="input"
            placeholder="AIza..."
            value={ytApiKey}
            onChange={(e) => setYtApiKey(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="yt-channel">Channel URL or Handle</label>
          <input
            id="yt-channel"
            type="text"
            className="input"
            placeholder="youtube.com/@handle or @handle"
            value={ytChannel}
            onChange={(e) => setYtChannel(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleSaveYouTube}
            disabled={ytSaving || (!ytApiKey.trim() && !ytChannel.trim())}
          >
            {ytSaving ? 'Saving...' : ytSaved ? '\u2713 Saved' : 'Save YouTube Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

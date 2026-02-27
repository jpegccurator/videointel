import { useState, useEffect } from 'react';
import { getYouTubeSettings, saveYouTubeSettings } from '../utils/db';

export default function SettingsModal({ isOpen, onClose, apiKey, serverHasKey, onSave, onTest }) {
  const [key, setKey] = useState(apiKey || '');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // YouTube settings
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytSource, setYtSource] = useState('');
  const [ytSaving, setYtSaving] = useState(false);
  const [ytSaved, setYtSaved] = useState(false);

  // Load YouTube settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setKey(apiKey || '');
      getYouTubeSettings().then((settings) => {
        if (settings) {
          setYtApiKey(settings.googleApiKey || '');
          setYtSource(settings.playlistUrl || settings.channelUrl || '');
        }
      });
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!key.trim() && !serverHasKey) return;
    if (key.trim()) onSave(key.trim());
    setTestResult(null);
    onClose();
  };

  const handleTest = async () => {
    if (!key.trim() && !serverHasKey) return;
    setTesting(true);
    setTestResult(null);
    if (key.trim()) onSave(key.trim());
    const result = await onTest(key.trim());
    setTestResult(result);
    setTesting(false);
  };

  const handleSaveYouTube = async () => {
    setYtSaving(true);
    setYtSaved(false);
    try {
      const existing = await getYouTubeSettings();
      const source = ytSource.trim();
      const isPlaylist = source.includes('list=') || source.startsWith('PL');

      await saveYouTubeSettings({
        ...existing,
        googleApiKey: ytApiKey.trim(),
        playlistUrl: isPlaylist ? source : '',
        channelUrl: isPlaylist ? '' : source,
        channelId: null,
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
        {serverHasKey ? (
          <div className="message message-success" style={{ marginBottom: 16 }}>
            OpenAI API key is pre-configured on this server. You can override it below, or leave blank to use the server key.
          </div>
        ) : (
          <p>Enter your OpenAI API key to use VideoIntel. Your key is stored locally in your browser.</p>
        )}

        <div className="form-group">
          <label htmlFor="api-key">OpenAI API Key</label>
          <input
            id="api-key"
            type="password"
            className="input"
            placeholder={serverHasKey ? 'Using server key (override optional)' : 'sk-...'}
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
            {serverHasKey && !key.trim() ? 'Close' : 'Cancel'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={(!key.trim() && !serverHasKey) || testing}
          >
            {testing ? 'Testing...' : 'Test Key'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!key.trim() && !serverHasKey}
          >
            {serverHasKey && !key.trim() ? 'Done' : 'Save'}
          </button>
        </div>

        {/* YouTube Section (Optional) */}
        <hr style={{ margin: '28px 0 20px', borderColor: 'var(--border, #333)' }} />

        <h3 style={{ marginBottom: 8 }}>
          YouTube Performance Tracking
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
            Optional
          </span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          Track how your shows perform on YouTube. Use a playlist URL if your shows are on a shared channel
          (e.g. one host on a multi-host channel). Requires a free Google API key (YouTube Data API v3).
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
          <label htmlFor="yt-source">Playlist URL, Channel URL, or Handle</label>
          <input
            id="yt-source"
            type="text"
            className="input"
            placeholder="youtube.com/playlist?list=PLxxx or @handle"
            value={ytSource}
            onChange={(e) => setYtSource(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Playlist URL recommended if you're one host on a shared channel
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleSaveYouTube}
            disabled={ytSaving || (!ytApiKey.trim() && !ytSource.trim())}
          >
            {ytSaving ? 'Saving...' : ytSaved ? '\u2713 Saved' : 'Save YouTube Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

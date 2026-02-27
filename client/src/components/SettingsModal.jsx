import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, apiKey, serverHasKey, onSave, onTest }) {
  const [key, setKey] = useState(apiKey || '');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) setKey(apiKey || '');
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

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
      </div>
    </div>
  );
}

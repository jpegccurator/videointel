import { useState } from 'react';

export default function SettingsModal({ isOpen, onClose, apiKey, onSave, onTest }) {
  const [key, setKey] = useState(apiKey || '');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
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
      </div>
    </div>
  );
}

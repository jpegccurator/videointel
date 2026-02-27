import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'videointel_openai_key';

export function useOpenAI() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [serverHasKey, setServerHasKey] = useState(false);
  const [defaults, setDefaults] = useState(null);

  // Check server defaults on mount
  useEffect(() => {
    fetch('/api/settings/defaults')
      .then((r) => r.json())
      .then((data) => {
        setDefaults(data);
        if (data.hasOpenAIKey) {
          setServerHasKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const saveKey = useCallback((key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  }, []);

  const testKey = useCallback(async (key) => {
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key,
        },
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  // User has a key if it's in localStorage OR the server has one via env var
  const hasKey = !!apiKey || serverHasKey;

  return { apiKey, hasKey, serverHasKey, defaults, saveKey, testKey };
}

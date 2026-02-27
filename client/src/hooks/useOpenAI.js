import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'videointel_openai_key';

export function useOpenAI() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [serverHasKey, setServerHasKey] = useState(false);

  useEffect(() => {
    fetch('/api/settings/defaults')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasOpenAIKey) setServerHasKey(true);
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
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const hasKey = !!apiKey || serverHasKey;

  return { apiKey, hasKey, serverHasKey, saveKey, testKey };
}

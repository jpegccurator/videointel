import { useState, useCallback } from 'react';

const STORAGE_KEY = 'videointel_openai_key';

export function useOpenAI() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');

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

  return { apiKey, hasKey: !!apiKey, saveKey, testKey };
}

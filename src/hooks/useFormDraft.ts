import { useState, useEffect, useCallback } from 'react';

function isTransientDraftKey(key: string) {
  return key.endsWith('showDialog') || key.endsWith('editingId') || key.endsWith('form');
}

export function useFormDraft<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `form-draft-${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      if (isTransientDraftKey(key)) {
        sessionStorage.removeItem(storageKey);
        return initialValue;
      }
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [value, storageKey]);

  const clear = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setValue(initialValue);
  }, [storageKey, initialValue]);

  return [value, setValue, clear];
}

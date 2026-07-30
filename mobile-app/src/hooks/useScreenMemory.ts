import { useCallback, useState, type SetStateAction } from 'react';

const screenMemory = new Map<string, unknown>();

export function clearScreenMemory(key: string) {
  screenMemory.delete(key);
}

export function useScreenMemory<T>(
  key: string,
  initialValue: T | (() => T)
) {
  const [value, setValue] = useState<T>(() => {
    if (screenMemory.has(key)) {
      return screenMemory.get(key) as T;
    }

    const resolvedInitial =
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
    screenMemory.set(key, resolvedInitial);
    return resolvedInitial;
  });

  const setRememberedValue = useCallback((action: SetStateAction<T>) => {
    setValue((current) => {
      const next =
        typeof action === 'function'
          ? (action as (current: T) => T)(current)
          : action;
      screenMemory.set(key, next);
      return next;
    });
  }, [key]);

  return [value, setRememberedValue] as const;
}

import { useCallback, useState } from 'react';

export function usePendingAction<K extends string = string>() {
  const [pending, setPending] = useState<K | null>(null);

  const run = useCallback(async <T>(key: K, work: () => Promise<T>) => {
    setPending(key);
    try {
      return await work();
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, run };
}

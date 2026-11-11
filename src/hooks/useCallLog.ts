import { useCallback, useEffect, useState } from 'react';
import { CALL_LOG_LIMIT } from '../constants';
import { Dialer, callEvents } from '../services/dialer';
import type { CallInfo, CallLogEntry } from '../types';

export function useCallLog() {
  const [items, setItems]     = useState<CallLogEntry[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const log = await Dialer.getCallLog(CALL_LOG_LIMIT);
      setItems(log);
      setError(null);
    } catch {
      setError('Allow call log access to see your history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    let timer: ReturnType<typeof setTimeout> | undefined;
    let sub: { remove(): void } | null = null;

    try {
      sub = callEvents.addListener('onCallState', (c: CallInfo) => {
        if (c.state === 'idle') {
          if (timer !== undefined) clearTimeout(timer);
          // Call log is written slightly after the call ends
          timer = setTimeout(() => void refresh(), 700);
        }
      });
    } catch {
      // Native module not linked — events won't fire, that's fine
    }

    return () => {
      try { sub?.remove(); } catch { /* no-op */ }
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [refresh]);

  return { items, error, loading, refresh };
}

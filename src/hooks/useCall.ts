import { useEffect, useState } from 'react';
import { Dialer, callEvents } from '../services/dialer';
import type { CallInfo } from '../types';

const IDLE: CallInfo = {
  state: 'idle',
  displayName: '',
  isPrivate: false,
  incoming: false,
  connectTime: 0,
  muted: false,
  speaker: false,
  photoUri: null,
  heldCallName: null,
  canMerge: false,
};

export function useCall(): CallInfo {
  const [call, setCall] = useState<CallInfo>(IDLE);

  useEffect(() => {
    // Fetch initial call state (safe — stub returns IDLE_CALL if native absent)
    Dialer.getCurrentCall().then(setCall).catch(() => { /* no-op */ });

    // Subscribe; guard against NativeEventEmitter throwing when module missing
    let sub: { remove(): void } | null = null;
    try {
      sub = callEvents.addListener('onCallState', (c: CallInfo) => setCall(c));
    } catch {
      // Native module not linked — events won't fire, that's fine
    }

    return () => {
      try { sub?.remove(); } catch { /* no-op */ }
    };
  }, []);

  return call;
}

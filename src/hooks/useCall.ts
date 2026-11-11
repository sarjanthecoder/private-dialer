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
  simSlot: null,
  simLabel: null,
};

export function useCall(): CallInfo {
  const [call, setCall] = useState<CallInfo>(IDLE);

  useEffect(() => {
    Dialer.getCurrentCall().then(setCall).catch(() => {});
    let sub: { remove(): void } | null = null;
    try {
      sub = callEvents.addListener('onCallState', (c: CallInfo) => setCall(c));
    } catch {
      // Native module not linked
    }
    return () => { try { sub?.remove(); } catch { /* no-op */ } };
  }, []);

  return call;
}

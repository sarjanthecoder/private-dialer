export type CallStateName = 'idle' | 'ringing' | 'dialing' | 'active' | 'holding' | 'disconnected';

export interface CallInfo {
  state: CallStateName;
  displayName: string;
  isPrivate: boolean;
  incoming: boolean;
  connectTime: number;
  muted: boolean;
  speaker: boolean;
  photoUri: string | null;
  heldCallName: string | null;
  canMerge: boolean;
}

export type CallLogType = 'incoming' | 'outgoing' | 'missed' | 'rejected';

export interface CallLogEntry {
  id: string;
  type: CallLogType;
  name: string;
  isPrivate: boolean;
  number: string; // empty for the private contact
  date: number;
  duration: number;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  photoUri: string | null;
}

export interface NewContact {
  name: string;
  number: string;
}

export type TabKey = 'dialer' | 'contacts' | 'history';

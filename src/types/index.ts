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
  simSlot: number | null;   // 1 or 2, null if unknown
  simLabel: string | null;  // e.g. "SIM 1 – Airtel"
}

export type CallLogType = 'incoming' | 'outgoing' | 'missed' | 'rejected';

export interface CallLogEntry {
  id: string;
  type: CallLogType;
  name: string;
  isPrivate: boolean;
  number: string;
  date: number;
  duration: number;
  simSlot: number | null;
  isBlocked?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  photoUri: string | null;
  emails?: string[];
  location?: string;
}

export interface NewContact {
  name: string;
  number: string;
  emails?: string[];
  location?: string;
  accountName?: string;
  accountType?: string;
}

export interface SimInfo {
  id: string;          // PhoneAccountHandle id string
  label: string;       // "SIM 1 – Jio" etc.
  slot: number;        // 0-based slot index
  displaySlot: number; // 1-based for UI
}

export type TabKey = 'dialer' | 'contacts' | 'history';

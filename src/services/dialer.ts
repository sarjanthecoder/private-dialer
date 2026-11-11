import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import type { NativeModule, Permission } from 'react-native';
import type { CallInfo, CallLogEntry, Contact, NewContact, SimInfo } from '../types';

export interface DialerNative {
  getCurrentCall(): Promise<CallInfo>;
  callPrivate(): Promise<boolean>;
  dial(digits: string, simId?: string): Promise<boolean>;
  resolveInput(digits: string): Promise<string | null>;
  answer(): void;
  reject(): void;
  hangup(): void;
  setMuted(muted: boolean): void;
  setSpeaker(on: boolean): void;
  sendDtmf(digit: string): void;
  isDefaultDialer(): Promise<boolean>;
  requestDefaultDialer(): Promise<boolean>;
  getCallLog(limit: number): Promise<CallLogEntry[]>;
  setHighRefreshRate(): Promise<number>;
  getContacts(): Promise<Contact[]>;
  addContact(contact: NewContact): Promise<string>;
  deleteContact(id: string): Promise<boolean>;
  getSims(): Promise<SimInfo[]>;
  hold(): void;
  unhold(): void;
  merge(): void;
}

const IDLE_CALL: CallInfo = {
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

const DialerStub: DialerNative = {
  getCurrentCall:       () => Promise.resolve(IDLE_CALL),
  callPrivate:          () => Promise.reject(new Error('Native module not linked')),
  dial:                 () => Promise.reject(new Error('Native module not linked')),
  resolveInput:         () => Promise.resolve(null),
  answer:               () => undefined,
  reject:               () => undefined,
  hangup:               () => undefined,
  setMuted:             () => undefined,
  setSpeaker:           () => undefined,
  sendDtmf:             () => undefined,
  isDefaultDialer:      () => Promise.resolve(false),
  requestDefaultDialer: () => Promise.resolve(false),
  getCallLog:           () => Promise.resolve([]),
  setHighRefreshRate:   () => Promise.resolve(60),
  getContacts:          () => Promise.resolve([]),
  addContact:           () => Promise.reject(new Error('Native module not linked')),
  deleteContact:        () => Promise.resolve(false),
  getSims:              () => Promise.resolve([]),
  hold:                 () => undefined,
  unhold:               () => undefined,
  merge:                () => undefined,
};

const nativeMod = NativeModules.Dialer as (DialerNative & NativeModule) | undefined;
export const Dialer: DialerNative = nativeMod ?? DialerStub;

export interface CallEventEmitter {
  addListener(eventType: 'onCallState', listener: (info: CallInfo) => void): { remove(): void };
}

export const callEvents: CallEventEmitter = nativeMod
  ? new NativeEventEmitter(nativeMod)
  : { addListener: () => ({ remove: () => undefined }) };

export async function requestRuntimePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const P = PermissionsAndroid.PERMISSIONS;
  const list: Permission[] = [
    P.CALL_PHONE,
    P.READ_PHONE_STATE,
    P.READ_CALL_LOG,
    P.ANSWER_PHONE_CALLS,
    P.READ_CONTACTS,
    P.WRITE_CONTACTS,
  ];
  if (Number(Platform.Version) >= 33) list.push(P.POST_NOTIFICATIONS);
  const res = await PermissionsAndroid.requestMultiple(list);
  return res[P.CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
}

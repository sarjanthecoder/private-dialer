import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Contact } from '../types';
import { Dialer } from '../services/dialer';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'android') {
        const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
        if (!has) {
          const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS, {
            title: 'Contacts Permission',
            message: 'RootAccess Dialer needs contacts permission to show and search your contacts.',
            buttonPositive: 'Allow',
          });
          if (res !== PermissionsAndroid.RESULTS.GRANTED) {
            if (mountedRef.current) {
              setError('Contacts permission denied. Tap to allow in Settings.');
              setLoading(false);
            }
            return;
          }
        }
      }

      const list = await Dialer.getContacts();
      if (mountedRef.current) {
        // Sort alphabetically by name
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setContacts(sorted);
      }
    } catch (err: unknown) {
      if (mountedRef.current) setError((err as Error)?.message ?? 'Could not load contacts');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { contacts, loading, error, refresh: load };
}


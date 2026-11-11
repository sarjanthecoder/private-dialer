import { useCallback, useEffect, useRef, useState } from 'react';
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
      const list = await Dialer.getContacts();
      if (mountedRef.current) {
        // Sort alphabetically by name
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setContacts(sorted);
      }
    } catch {
      if (mountedRef.current) setError('Could not load contacts');
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


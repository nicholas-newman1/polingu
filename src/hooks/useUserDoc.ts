import { useCallback, useEffect, useState } from 'react';
import type { UserDoc } from '../lib/storage/userDocs';
import { useSaveError } from './useSaveError';
import { useAuthContext } from '../contexts/AuthContext';

interface DocState<T> {
  uid: string | null;
  value: T;
  loading: boolean;
}

function initialState<T>(uid: string | null, doc: UserDoc<T>): DocState<T> {
  return { uid, value: doc.defaults, loading: uid !== null };
}

/**
 * The signed-in user's copy of a settings document: the defaults until it loads,
 * and the defaults again when the user signs out. `update` applies a new value at once
 * and saves it; a failed save keeps the change on the device to sync later.
 */
export function useUserDoc<T>(doc: UserDoc<T>) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const [state, setState] = useState(() => initialState(uid, doc));
  const showSaveError = useSaveError();

  if (state.uid !== uid) setState(initialState(uid, doc));

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void doc.load().then((value) => {
      if (!cancelled) setState({ uid, value, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [uid, doc]);

  const update = useCallback(
    (next: T) => {
      setState((current) => ({ ...current, value: next }));
      return doc.save(next).catch(showSaveError);
    },
    [doc, showSaveError]
  );

  return { value: state.value, loading: state.loading, update };
}

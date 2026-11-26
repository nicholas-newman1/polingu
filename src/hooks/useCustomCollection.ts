import { useEffect, useState } from 'react';
import { useAuthContext } from './useAuthContext';

/** Live list of the signed-in user's custom items, reset when the user changes. */
export function useCustomCollection<T>(subscribe: (onChange: (items: T[]) => void) => () => void) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [prevUid, setPrevUid] = useState(user?.uid);
  if (prevUid !== user?.uid) {
    setPrevUid(user?.uid);
    setIsLoading(true);
    setItems([]);
  }

  useEffect(() => {
    if (!user) return;
    // The storage subscribe can still deliver a snapshot it was already processing after
    // it is closed (its handler awaits IndexedDB), so ignore anything that arrives late.
    let active = true;
    const unsubscribe = subscribe((next) => {
      if (!active) return;
      setItems(next);
      setIsLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, subscribe]);

  return { items, setItems, isLoading };
}

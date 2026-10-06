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
    return subscribe((next) => {
      setItems(next);
      setIsLoading(false);
    });
  }, [user, subscribe]);

  return { items, setItems, isLoading };
}

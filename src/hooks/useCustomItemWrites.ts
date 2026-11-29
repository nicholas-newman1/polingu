import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { CollectionStorage } from '../lib/storage/createCustomCollectionStorage';
import type { CustomItemBase } from '../types/customItems';

/**
 * Saves one custom item at a time, showing the change in `setItems` (the review
 * context's list) straight away. A write the server refuses is undone in storage, so
 * the list is then put back from there and the error rethrown for the caller to report.
 */
export function useCustomItemWrites<T extends CustomItemBase>(
  storage: CollectionStorage<T>,
  setItems: Dispatch<SetStateAction<T[]>>
) {
  return useMemo(() => {
    async function write(change: (items: T[]) => T[], persist: () => Promise<void>) {
      setItems(change);
      try {
        await persist();
      } catch (e) {
        setItems(await storage.load());
        throw e;
      }
    }

    return {
      add: (item: T) =>
        write(
          (items) => [...items, item],
          () => storage.add(item)
        ),
      update: (id: string, changes: Partial<T>) =>
        write(
          (items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
          () => storage.update(id, changes)
        ),
      remove: (id: string) =>
        write(
          (items) => items.filter((item) => item.id !== id),
          () => storage.delete(id)
        ),
    };
  }, [storage, setItems]);
}

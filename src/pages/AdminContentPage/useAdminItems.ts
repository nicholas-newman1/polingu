import { useCallback } from 'react';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface UseAdminItemsOptions<T extends { id: unknown }, TPatch> {
  items: T[];
  setItems: (items: T[]) => void;
  update: (item: T, patch: TPatch) => Promise<void>;
  remove: (item: T) => Promise<void>;
  /** Capitalised singular noun for snackbar messages, e.g. "Sentence". */
  label: string;
}

/** Persists edits and deletes of system content and mirrors them into the local list. */
export function useAdminItems<T extends { id: unknown }, TPatch extends Partial<T>>({
  items,
  setItems,
  update,
  remove,
  label,
}: UseAdminItemsOptions<T, TPatch>) {
  const { showSnackbar } = useSnackbar();
  const lowerLabel = label.toLowerCase();

  const deleteItem = useCallback(
    async (item: T) => {
      try {
        await remove(item);
        setItems(items.filter((other) => other.id !== item.id));
        showSnackbar(`${label} deleted`, 'success');
      } catch {
        showSnackbar(`Failed to delete ${lowerLabel}`, 'error');
      }
    },
    [items, setItems, remove, label, lowerLabel, showSnackbar]
  );

  /** Applies a change the server has already stored to the local list only. */
  const mirrorItem = useCallback(
    (item: T | null, patch: Partial<T>) => {
      if (!item) return;
      setItems(items.map((other) => (other.id === item.id ? { ...other, ...patch } : other)));
    },
    [items, setItems]
  );

  const patchItem = useCallback(
    async (item: T | null, patch: TPatch) => {
      if (!item) return;
      try {
        await update(item, patch);
        mirrorItem(item, patch);
        showSnackbar(`${label} updated`, 'success');
      } catch {
        showSnackbar(`Failed to update ${lowerLabel}`, 'error');
      }
    },
    [update, mirrorItem, label, lowerLabel, showSnackbar]
  );

  return { deleteItem, patchItem, mirrorItem };
}

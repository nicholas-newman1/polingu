import { useCallback } from 'react';
import { useSnackbar } from '../../hooks/useSnackbar';

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

  const patchItem = useCallback(
    async (
      item: T | null,
      patch: TPatch,
      messages: { success?: string; error: string } = {
        success: `${label} updated`,
        error: `Failed to update ${lowerLabel}`,
      }
    ) => {
      if (!item) return;
      try {
        await update(item, patch);
        setItems(items.map((other) => (other.id === item.id ? { ...other, ...patch } : other)));
        if (messages.success) showSnackbar(messages.success, 'success');
      } catch {
        showSnackbar(messages.error, 'error');
      }
    },
    [items, setItems, update, label, lowerLabel, showSnackbar]
  );

  return { deleteItem, patchItem };
}

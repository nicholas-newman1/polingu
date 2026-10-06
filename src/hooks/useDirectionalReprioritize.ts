import { useCallback } from 'react';
import type { TranslationDirection } from '../types/common';
import { useSnackbar } from './useSnackbar';

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];

interface DirectionalReprioritizeOptions<Store, Id> {
  stores: Record<TranslationDirection, Store>;
  updateStore: (direction: TranslationDirection, store: Store) => Promise<void>;
  reprioritize: (store: Store, id: Id) => Store;
  canReprioritize: (stores: Record<TranslationDirection, Store>, id: Id) => boolean;
  queuedMessage: string;
  duplicateMessage: string;
}

/** "Review again" for items reviewed in both directions, plus the duplicate-item snackbar offering it. */
export function useDirectionalReprioritize<Store, Id>({
  stores,
  updateStore,
  reprioritize: reprioritizeInStore,
  canReprioritize: canReprioritizeInStores,
  queuedMessage,
  duplicateMessage,
}: DirectionalReprioritizeOptions<Store, Id>) {
  const { showSnackbar } = useSnackbar();

  const canReprioritize = useCallback(
    (id: Id) => canReprioritizeInStores(stores, id),
    [canReprioritizeInStores, stores]
  );

  const reprioritize = useCallback(
    (id: Id) => {
      const updates = DIRECTIONS.flatMap((direction) => {
        const store = stores[direction];
        const next = reprioritizeInStore(store, id);
        return next === store ? [] : [updateStore(direction, next)];
      });
      if (updates.length === 0) return;
      void Promise.all(updates);
      showSnackbar(queuedMessage, 'success');
    },
    [stores, reprioritizeInStore, updateStore, showSnackbar, queuedMessage]
  );

  const showDuplicateError = useCallback(
    (duplicateId: Id) => {
      showSnackbar(
        duplicateMessage,
        'error',
        canReprioritize(duplicateId)
          ? { action: { label: 'Review again', onClick: () => reprioritize(duplicateId) } }
          : undefined
      );
    },
    [showSnackbar, duplicateMessage, canReprioritize, reprioritize]
  );

  return { canReprioritize, reprioritize, showDuplicateError };
}

import { useCallback, useEffect, useRef } from 'react';
import type { CardReviewData, ReviewDataStore, SessionId } from '../types/common';
import type { DeckPart } from '../lib/storage/reviewDeckDocs';
import { partsOf } from '../lib/storage/reviewDeckStorage';
import {
  canReprioritize as studiedInAnyPart,
  reprioritizeCard,
} from '../lib/storage/reprioritizeCard';
import { useSnackbar } from '../contexts/SnackbarContext';

interface ReprioritizeOptions<K extends DeckPart, R extends CardReviewData, Id extends SessionId> {
  /** The deck's progress, as its context provides it. */
  progress: {
    stores: Record<K, ReviewDataStore<R, Id>>;
    updateStore: (part: K, store: ReviewDataStore<R, Id>) => Promise<void>;
  };
  /** How "Review again" changes one part's store; reprioritizeCard unless the deck needs more. */
  reprioritize?: (store: ReviewDataStore<R, Id>, id: Id) => ReviewDataStore<R, Id>;
  queuedMessage: string;
  duplicateMessage: string;
}

/**
 * "Review again" for a deck's cards, in every part (direction) they were studied in,
 * plus the duplicate-item snackbar offering it.
 */
export function useReprioritize<
  K extends DeckPart,
  R extends CardReviewData,
  Id extends SessionId,
>({
  progress: { stores, updateStore },
  reprioritize: reprioritizeInStore = reprioritizeCard,
  queuedMessage,
  duplicateMessage,
}: ReprioritizeOptions<K, R, Id>) {
  const { showSnackbar } = useSnackbar();
  // The duplicate warning's action can be clicked seconds after it is shown, so the
  // change is made to the stores at click time, not to those it was created with.
  const storesRef = useRef(stores);
  useEffect(() => {
    storesRef.current = stores;
  }, [stores]);

  /** Applies `change` to each part's latest store, saves the parts it changed, and says if any were. */
  const updateEachStore = useCallback(
    (change: (store: ReviewDataStore<R, Id>) => ReviewDataStore<R, Id>) => {
      let changed = false;
      for (const part of partsOf(storesRef.current)) {
        const store = storesRef.current[part];
        const next = change(store);
        if (next === store) continue;
        changed = true;
        void updateStore(part, next);
      }
      return changed;
    },
    [updateStore]
  );

  const canReprioritize = useCallback((id: Id) => studiedInAnyPart(stores, id), [stores]);

  const reprioritize = useCallback(
    (id: Id) => {
      if (updateEachStore((store) => reprioritizeInStore(store, id))) {
        showSnackbar(queuedMessage, 'success');
      }
    },
    [updateEachStore, reprioritizeInStore, showSnackbar, queuedMessage]
  );

  const showDuplicateError = useCallback(
    (duplicateId: Id, message: string = duplicateMessage) => {
      showSnackbar(
        message,
        'error',
        canReprioritize(duplicateId)
          ? { action: { label: 'Review again', onClick: () => reprioritize(duplicateId) } }
          : undefined
      );
    },
    [showSnackbar, duplicateMessage, canReprioritize, reprioritize]
  );

  return { canReprioritize, reprioritize, showDuplicateError, updateEachStore };
}

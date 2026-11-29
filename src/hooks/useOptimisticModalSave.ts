import { useCallback } from 'react';
import { useSaveError } from './useSaveError';

/**
 * Return `false` (synchronously) to keep the modal open. A promise is never waited for,
 * so it can't keep the modal open.
 */
export type ModalSaveResult = void | boolean | Promise<void>;

interface OptimisticModalSaveOptions<T extends unknown[]> {
  onSave: (...data: T) => ModalSaveResult;
  onClose: () => void;
}

/** Keeps synchronous validation failures open, then closes without waiting for persistence. */
export function useOptimisticModalSave<T extends unknown[]>({
  onSave,
  onClose,
}: OptimisticModalSaveOptions<T>) {
  const showSaveError = useSaveError();

  return useCallback(
    (...data: T) => {
      try {
        const result = onSave(...data);
        if (result === false) return;
        onClose();
        void Promise.resolve(result).catch(showSaveError);
      } catch (e) {
        showSaveError(e);
      }
    },
    [onSave, onClose, showSaveError]
  );
}

import { useCallback } from 'react';
import { useSnackbar } from '../contexts/SnackbarContext';

const SAVE_ERROR_MESSAGE = 'Failed to save. Please try again.';

/** Tells the learner a save failed, and logs why. */
export function useSaveError() {
  const { showSnackbar } = useSnackbar();
  return useCallback(
    (error?: unknown) => {
      console.error('Firebase save error:', error);
      showSnackbar(SAVE_ERROR_MESSAGE, 'error');
    },
    [showSnackbar]
  );
}

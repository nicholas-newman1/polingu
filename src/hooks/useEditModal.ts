import { useBackClose } from './useBackClose';
import { useOptimisticModalSave, type ModalSaveResult } from './useOptimisticModalSave';

interface EditModalOptions<T extends unknown[]> {
  open: boolean;
  onClose: () => void;
  onSave: (...data: T) => ModalSaveResult;
  /** Clears the modal back to its empty state; runs on every close. */
  reset: () => void;
  onAudioUpdated?: (audioUrl: string) => void;
}

/**
 * Close and save handling shared by the edit modals. Every close, back navigation
 * included, resets the modal; saving closes it without waiting for persistence; and
 * regenerated audio, already stored by the server, is reported and closes it too.
 */
export function useEditModal<T extends unknown[]>({
  open,
  onClose,
  onSave,
  reset,
  onAudioUpdated,
}: EditModalOptions<T>) {
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAudioSaved = (audioUrl: string) => {
    onAudioUpdated?.(audioUrl);
    handleClose();
  };

  useBackClose(open, handleClose);

  const save = useOptimisticModalSave({ onSave, onClose: handleClose });

  return { handleClose, handleAudioSaved, save };
}

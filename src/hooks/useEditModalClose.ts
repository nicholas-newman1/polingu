import { useState } from 'react';
import { useBackClose } from './useBackClose';

interface EditModalCloseOptions {
  open: boolean;
  onClose: () => void;
  resetForm: () => void;
  onAudioUpdated?: (audioUrl: string) => void;
}

/** Close handling shared by edit modals: resets the form, closes on back navigation, and closes once audio is regenerated. */
export function useEditModalClose({
  open,
  onClose,
  resetForm,
  onAudioUpdated,
}: EditModalCloseOptions) {
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);

  const handleClose = () => {
    resetForm();
    setPendingAudioUrl(null);
    onClose();
  };

  const handleAudioSaved = (audioUrl: string) => {
    setPendingAudioUrl(audioUrl);
    onAudioUpdated?.(audioUrl);
    handleClose();
  };

  useBackClose(open, handleClose);

  return { pendingAudioUrl, handleClose, handleAudioSaved };
}

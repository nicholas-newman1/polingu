import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useEditModalClose } from './useEditModalClose';
import { useOptimisticModalSave, type ModalSaveResult } from './useOptimisticModalSave';
import {
  usePolishEnglishFormAutoTranslate,
  type PolishEnglishFieldNames,
} from './usePolishEnglishAutoTranslate';

interface TranslatedEditModalOptions<T extends FieldValues, D> {
  open: boolean;
  onClose: () => void;
  onSave: (data: D) => ModalSaveResult;
  onAudioUpdated?: (audioUrl: string) => void;
  form: Pick<UseFormReturn<T>, 'getValues' | 'setValue'>;
  /** Clears the form back to its empty state when the modal closes. */
  resetForm: () => void;
  fieldNames?: PolishEnglishFieldNames;
}

/**
 * Edit-modal wiring for a form with an auto-translating Polish/English pair:
 * close handling that also cancels pending translations, plus optimistic save.
 */
export function useTranslatedEditModal<T extends FieldValues, D>({
  open,
  onClose,
  onSave,
  onAudioUpdated,
  form,
  resetForm,
  fieldNames,
}: TranslatedEditModalOptions<T, D>) {
  const translation = usePolishEnglishFormAutoTranslate(form, { fieldNames });

  const { pendingAudioUrl, handleClose, handleAudioSaved } = useEditModalClose({
    open,
    onClose,
    resetForm: () => {
      resetForm();
      translation.cancel();
    },
    onAudioUpdated,
  });

  const save = useOptimisticModalSave({ onSave, onClose: handleClose });

  return { translation, pendingAudioUrl, handleClose, handleAudioSaved, save };
}

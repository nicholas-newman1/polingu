import { Controller, useForm, useWatch } from 'react-hook-form';
import { DialogTitle, IconButton, Divider, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { useValueWhileOpen } from '../hooks/useValueWhileOpen';
import { FormSelectField, FormTextField } from './FormFields';
import { type ModalSaveResult } from '../hooks/useOptimisticModalSave';
import { useAuthContext } from '../contexts/AuthContext';
import { useEditModal } from '../hooks/useEditModal';
import { usePolishEnglishFormAutoTranslate } from '../hooks/usePolishEnglishAutoTranslate';
import { useConfirm } from '../hooks/useConfirm';
import { containsWholePhrase } from '../lib/utils/containsWholePhrase';
import { CASES, GENDERS, NUMBERS } from '../constants';
import { AudioRegenerator } from './AudioRegenerator';
import { PolishEnglishFields } from './PolishEnglishFields';
import type { DeclensionCard, Case, Gender, Number } from '../types';

const TRANSLATION_FIELD_NAMES = { polish: 'back', english: 'english' };

interface FormData {
  front: string;
  back: string;
  english: string;
  declined: string;
  // Empty until chosen: a new card must not silently default to the wrong grammar.
  case: Case | '';
  gender: Gender | '';
  number: Number;
  hint: string;
}

interface EditDeclensionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<DeclensionCard, 'id' | 'isCustom'>) => ModalSaveResult;
  onDelete?: () => void;
  /** The card to edit, or null to create a new one. */
  card: DeclensionCard | null;
  onAudioUpdated?: (audioUrl: string) => void;
}

const getDefaultValues = (card: DeclensionCard | null): FormData => ({
  front: card?.front || '',
  back: card?.back || '',
  english: card?.english || '',
  declined: card?.declined || '',
  case: card?.case || '',
  gender: card?.gender || '',
  number: card?.number || 'Singular',
  hint: card?.hint || '',
});

export function EditDeclensionModal({
  open,
  onClose,
  onSave,
  onDelete,
  card,
  onAudioUpdated,
}: EditDeclensionModalProps) {
  const { isAdmin } = useAuthContext();
  const isCreating = !useValueWhileOpen(card, open);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(card),
    mode: 'onChange',
  });

  const backText = useWatch({ control, name: 'back' });
  const declinedText = useWatch({ control, name: 'declined' });
  const { confirm, confirmDialog } = useConfirm();

  const translation = usePolishEnglishFormAutoTranslate(
    { getValues, setValue },
    { fieldNames: TRANSLATION_FIELD_NAMES }
  );

  const { handleClose, handleAudioSaved, save } = useEditModal({
    open,
    onClose,
    onSave,
    onAudioUpdated,
    reset: () => {
      reset(getDefaultValues(null));
      translation.cancel();
    },
  });
  // Built-in cards always carry a translation; custom cards may leave it out.
  const englishRequired = !!card && !card.isCustom;
  // Checked only on the learner's own cards, so an admin is never blocked from editing built-in ones.
  const declinedNotInBack =
    (!card || !!card.isCustom) &&
    !!declinedText.trim() &&
    !!backText.trim() &&
    !containsWholePhrase(backText, declinedText);

  const onSubmit = (data: FormData) => {
    if (declinedNotInBack || !data.case || !data.gender) return;
    save({
      front: data.front.trim(),
      back: data.back.trim(),
      // undefined (rather than omitted) so clearing a field removes the saved value.
      english: data.english.trim() || undefined,
      declined: data.declined.trim(),
      case: data.case,
      gender: data.gender,
      number: data.number,
      hint: data.hint.trim() || undefined,
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = await confirm({
      title: 'Delete Card',
      message: 'Are you sure you want to delete this card?',
      confirmLabel: 'Delete',
    });
    if (confirmed) onDelete();
  };

  const title = isCreating
    ? 'Create Custom Card'
    : card?.isCustom
      ? 'Edit Custom Card'
      : 'Edit Declension Card';

  return (
    <ModalDialog open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>{title}</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        {isAdmin && card && (
          <>
            <AudioRegenerator
              text={backText}
              type={card.isCustom ? 'custom-declension' : 'declension'}
              id={String(card.id)}
              currentAudioUrl={card.audioUrl}
              onAudioSaved={handleAudioSaved}
              label="Card Audio (Back)"
            />
            <Divider sx={{ my: 1 }} />
          </>
        )}

        <FormTextField
          name="front"
          control={control}
          label="Front (Question)"
          autoFocus
          required
          multiline
          placeholder="e.g., To jest _____ (kot, masculine)"
        />
        <PolishEnglishFields
          control={control}
          translation={translation}
          dataQaPrefix="edit-declension"
          multiline
          names={TRANSLATION_FIELD_NAMES}
          labels={{
            polish: 'Back (Answer)',
            english: englishRequired ? 'English Translation' : 'English Translation (optional)',
          }}
          placeholders={{ polish: 'e.g., To jest kot.', english: 'e.g., This is a cat.' }}
          englishRequired={englishRequired}
        />
        <Controller
          name="declined"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Declined Word"
              fullWidth
              required
              placeholder="e.g., kot"
              error={declinedNotInBack}
              helperText={
                declinedNotInBack
                  ? 'The declined word must appear in the Back (Answer).'
                  : undefined
              }
            />
          )}
        />
        <FormSelectField name="case" control={control} label="Case" options={CASES} required />
        <FormSelectField
          name="gender"
          control={control}
          label="Gender"
          options={GENDERS}
          required
        />
        <FormSelectField
          name="number"
          control={control}
          label="Number"
          options={NUMBERS}
          required
        />
        <FormTextField
          name="hint"
          control={control}
          label="Hint (optional)"
          multiline
          placeholder="Explanation of the grammar rule..."
        />
      </ModalContent>
      <ModalFooter
        onCancel={handleClose}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel={isCreating ? 'Create Card' : 'Save Changes'}
        submitDisabled={!isValid || declinedNotInBack}
        destructiveAction={
          onDelete && { label: 'Delete', icon: <DeleteIcon />, onClick: handleDelete }
        }
      />
      {confirmDialog}
    </ModalDialog>
  );
}

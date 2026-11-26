import { useForm, useWatch } from 'react-hook-form';
import { DialogTitle, IconButton, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { FormSelectField, FormTextField } from './FormFields';
import { type ModalSaveResult } from '../hooks/useOptimisticModalSave';
import { useAuthContext } from '../hooks/useAuthContext';
import { useTranslatedEditModal } from '../hooks/useTranslatedEditModal';
import { AudioRegenerator } from './AudioRegenerator';
import { PolishEnglishFields } from './PolishEnglishFields';
import type { DeclensionCard, Case, Gender, Number } from '../types';

const CASES: Case[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];

const GENDERS: Gender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];

const NUMBERS: Number[] = ['Singular', 'Plural'];

const TRANSLATION_FIELD_NAMES = { polish: 'back', english: 'english' };

interface FormData {
  front: string;
  back: string;
  english: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  hint: string;
}

interface EditDeclensionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<DeclensionCard, 'id' | 'isCustom'>) => ModalSaveResult;
  onDelete?: () => void;
  card: DeclensionCard | null;
  isCreating?: boolean;
  onAudioUpdated?: (audioUrl: string) => void;
}

const getDefaultValues = (card: DeclensionCard | null): FormData => ({
  front: card?.front || '',
  back: card?.back || '',
  english: card?.english || '',
  declined: card?.declined || '',
  case: card?.case || 'Nominative',
  gender: card?.gender || 'Masculine',
  number: card?.number || 'Singular',
  hint: card?.hint || '',
});

export function EditDeclensionModal({
  open,
  onClose,
  onSave,
  onDelete,
  card,
  isCreating = false,
  onAudioUpdated,
}: EditDeclensionModalProps) {
  const { isAdmin } = useAuthContext();

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

  const { translation, pendingAudioUrl, handleClose, handleAudioSaved, save } =
    useTranslatedEditModal({
      open,
      onClose,
      onSave,
      onAudioUpdated,
      form: { getValues, setValue },
      resetForm: () => reset(getDefaultValues(null)),
      fieldNames: TRANSLATION_FIELD_NAMES,
    });
  // Built-in cards always carry a translation; custom cards may leave it out.
  const englishRequired = !isCreating && !!card && !card.isCustom;

  const onSubmit = (data: FormData) => {
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

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this card?')) {
      onDelete();
    }
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
        {isAdmin && card && !isCreating && (
          <>
            <AudioRegenerator
              text={backText}
              type={card.isCustom ? 'custom-declension' : 'declension'}
              id={String(card.id)}
              currentAudioUrl={pendingAudioUrl || card.audioUrl}
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
        <FormTextField
          name="declined"
          control={control}
          label="Declined Word"
          required
          placeholder="e.g., kot"
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
        submitDisabled={!isValid}
        destructiveAction={
          onDelete && { label: 'Delete', icon: <DeleteIcon />, onClick: handleDelete }
        }
      />
    </ModalDialog>
  );
}

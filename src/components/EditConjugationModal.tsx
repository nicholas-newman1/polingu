import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import {
  DialogTitle,
  IconButton,
  TextField,
  Box,
  Button,
  Typography,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { FormTextField, FormYesNoField, VerbDetailsFields } from './FormFields';
import { useEditModalClose } from '../hooks/useEditModalClose';
import { useAuthContext } from '../hooks/useAuthContext';
import { AudioRegenerator } from './AudioRegenerator';
import type { DrillableForm, ConjugationForm, Aspect, VerbClass } from '../types/conjugation';
import { TENSE_LABELS } from '../types/conjugation';

const VERB_FIELD_NAMES = {
  infinitive: 'infinitive',
  infinitiveEn: 'infinitiveEn',
  aspect: 'aspect',
  verbClass: 'verbClass',
} as const;

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  marginTop: theme.spacing(1),
}));

const AlternativeRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

interface FormData {
  // Verb-level fields
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  verbClass: VerbClass;
  isReflexive: boolean;
  // Form-level fields
  pl: string;
  plAlternatives: { value: string }[];
  en: string;
}

interface EditConjugationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    verbUpdates: {
      infinitive: string;
      infinitiveEn: string;
      aspect: Aspect;
      verbClass: VerbClass;
      isReflexive: boolean;
    },
    formUpdates: ConjugationForm
  ) => void;
  onDelete?: () => void;
  form: DrillableForm | null;
  onAudioUpdated?: (audioUrl: string) => void;
}

const getDefaultValues = (form: DrillableForm | null): FormData => ({
  infinitive: form?.verb.infinitive || '',
  infinitiveEn: form?.verb.infinitiveEn || '',
  aspect: form?.verb.aspect || 'Imperfective',
  verbClass: form?.verb.verbClass || '-ać',
  isReflexive: form?.verb.isReflexive || false,
  pl: form?.form.pl || '',
  plAlternatives: form?.form.plAlternatives?.map((v) => ({ value: v })) || [],
  en: form?.form.en?.join(', ') || '',
});

export function EditConjugationModal({
  open,
  onClose,
  onSave,
  onDelete,
  form,
  onAudioUpdated,
}: EditConjugationModalProps) {
  const { isAdmin } = useAuthContext();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(form),
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'plAlternatives',
  });

  const plText = useWatch({ control, name: 'pl' });

  const { pendingAudioUrl, handleClose, handleAudioSaved } = useEditModalClose({
    open,
    onClose,
    resetForm: () => reset(getDefaultValues(null)),
    onAudioUpdated,
  });

  const onSubmit = (data: FormData) => {
    const verbUpdates = {
      infinitive: data.infinitive.trim(),
      infinitiveEn: data.infinitiveEn.trim(),
      aspect: data.aspect,
      verbClass: data.verbClass,
      isReflexive: data.isReflexive,
    };

    const enTranslations = data.en
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const plAlts = data.plAlternatives.map((a) => a.value.trim()).filter((s) => s.length > 0);

    const formUpdates: ConjugationForm = {
      pl: data.pl.trim(),
      en: enTranslations,
      ...(plAlts.length > 0 && { plAlternatives: plAlts }),
    };

    onSave(verbUpdates, formUpdates);
    handleClose();
  };

  const handleDelete = () => {
    if (
      onDelete &&
      window.confirm(
        'Are you sure you want to delete this verb? This will remove all conjugation forms for this verb and affect all users.'
      )
    ) {
      onDelete();
      handleClose();
    }
  };

  const tenseLabel = form ? TENSE_LABELS[form.tense] : '';
  const personLabel = form ? `${form.person} person ${form.number.toLowerCase()}` : '';
  const genderLabel = form?.gender ? ` (${form.gender.toLowerCase()})` : '';

  return (
    <ModalDialog open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Conjugation</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        {form && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tenseLabel} · {personLabel}
            {genderLabel}
          </Typography>
        )}

        <SectionLabel>Verb Details</SectionLabel>

        <VerbDetailsFields control={control} names={VERB_FIELD_NAMES} autoFocus withPlaceholders />

        <FormYesNoField
          name="isReflexive"
          control={control}
          label="Reflexive"
          yesLabel="Yes (się)"
        />

        <Divider sx={{ my: 1 }} />
        <SectionLabel>This Form ({form?.formKey})</SectionLabel>

        {isAdmin && form && (
          <>
            <AudioRegenerator
              text={plText}
              type="conjugation"
              id={form.verb.id}
              subPath={`${form.verb.id}_${form.tense}_${form.formKey}`}
              currentAudioUrl={pendingAudioUrl || form.form.audioUrl}
              onAudioSaved={handleAudioSaved}
              label="Form Audio"
            />
            <Divider sx={{ my: 1 }} />
          </>
        )}

        <FormTextField
          name="pl"
          control={control}
          label="Polish Form"
          required
          placeholder="e.g., robię"
        />

        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Polish Alternatives (optional)
          </Typography>
          {fields.map((field, index) => (
            <AlternativeRow key={field.id} sx={{ mb: 1 }}>
              <Controller
                name={`plAlternatives.${index}.value`}
                control={control}
                render={({ field }) => (
                  <TextField {...field} size="small" fullWidth placeholder="Alternative form" />
                )}
              />
              <IconButton onClick={() => remove(index)} size="small" color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </AlternativeRow>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={() => append({ value: '' })}>
            Add Alternative
          </Button>
        </Box>

        <FormTextField
          name="en"
          control={control}
          label="English Translations"
          required
          multiline
          placeholder="Comma-separated, e.g., I do, I am doing, I make"
          helperText="Separate multiple translations with commas"
        />
      </ModalContent>
      <ModalFooter
        onCancel={handleClose}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel="Save Changes"
        submitDisabled={!isValid}
        destructiveAction={
          onDelete && { label: 'Delete Verb', icon: <DeleteIcon />, onClick: handleDelete }
        }
      />
    </ModalDialog>
  );
}

import { useState, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  DialogTitle,
  IconButton,
  TextField,
  Box,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '../lib/styled';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { FormTextField, FormYesNoField, VerbDetailsFields } from './FormFields';
import { useEditModalClose } from '../hooks/useEditModalClose';
import { AudioRegenerator, InlineAudioRegenerator } from './AudioRegenerator';
import type { Verb, Aspect, VerbClass, Tense, ConjugationForm } from '../types/conjugation';
import {
  TENSE_LABELS,
  PRESENT_FORM_KEYS,
  PAST_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  CONDITIONAL_FORM_KEYS,
} from '../types/conjugation';

const VERB_FIELD_NAMES = {
  infinitive: 'infinitive',
  infinitiveEn: 'infinitiveEn',
  aspect: 'aspect',
  verbClass: 'verbClass',
} as const;

const TENSE_FORM_KEYS: Record<Tense, readonly string[]> = {
  present: PRESENT_FORM_KEYS,
  past: PAST_FORM_KEYS,
  future: FUTURE_FORM_KEYS,
  imperative: IMPERATIVE_FORM_KEYS,
  conditional: CONDITIONAL_FORM_KEYS,
};

const cloneConjugations = (verb: Verb | null): Verb['conjugations'] =>
  verb ? JSON.parse(JSON.stringify(verb.conjugations)) : {};

function updateConjugationForm(
  conjugations: Verb['conjugations'],
  tense: Tense,
  formKey: string,
  update: (form: ConjugationForm) => ConjugationForm
): Verb['conjugations'] {
  const tenseForms = conjugations[tense] as Record<string, ConjugationForm> | undefined;
  const currentForm = tenseForms?.[formKey];
  if (!tenseForms || !currentForm) return conjugations;
  return { ...conjugations, [tense]: { ...tenseForms, [formKey]: update(currentForm) } };
}

const FormRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  marginBottom: theme.spacing(0.75),
}));

const FormKeyLabel = styled(Typography)({
  width: 56,
  flexShrink: 0,
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  textAlign: 'right',
});

interface MetadataFormData {
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  aspectPair: string;
  verbClass: VerbClass;
  isIrregular: boolean;
  isReflexive: boolean;
}

interface EditVerbModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Omit<Verb, 'id'>>) => void;
  onDelete?: () => void;
  verb: Verb | null;
  onAudioUpdated?: (audioUrl: string) => void;
}

const getDefaultValues = (verb: Verb | null): MetadataFormData => ({
  infinitive: verb?.infinitive || '',
  infinitiveEn: verb?.infinitiveEn || '',
  aspect: verb?.aspect || 'Imperfective',
  aspectPair: verb?.aspectPair || '',
  verbClass: verb?.verbClass || '-ać',
  isIrregular: verb?.isIrregular || false,
  isReflexive: verb?.isReflexive || false,
});

export function EditVerbModal({
  open,
  onClose,
  onSave,
  onDelete,
  verb,
  onAudioUpdated,
}: EditVerbModalProps) {
  const [editConjugations, setEditConjugations] = useState(() => cloneConjugations(verb));
  const [prevVerb, setPrevVerb] = useState(verb);
  if (verb !== prevVerb) {
    setPrevVerb(verb);
    setEditConjugations(cloneConjugations(verb));
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<MetadataFormData>({
    values: getDefaultValues(verb),
    mode: 'onChange',
  });

  const infinitiveText = useWatch({ control, name: 'infinitive' });

  const { pendingAudioUrl, handleClose, handleAudioSaved } = useEditModalClose({
    open,
    onClose,
    resetForm: () => {
      reset(getDefaultValues(null));
      setEditConjugations({});
    },
    onAudioUpdated,
  });

  const updateFormField = useCallback(
    (tense: Tense, formKey: string, field: 'pl' | 'en', value: string) => {
      setEditConjugations((prev) =>
        updateConjugationForm(prev, tense, formKey, (form) =>
          field === 'pl'
            ? { ...form, pl: value }
            : {
                ...form,
                en: value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              }
        )
      );
    },
    []
  );

  const handleFormAudioSaved = useCallback((tense: Tense, formKey: string, audioUrl: string) => {
    setEditConjugations((prev) =>
      updateConjugationForm(prev, tense, formKey, (form) => ({ ...form, audioUrl }))
    );
  }, []);

  const onSubmit = (data: MetadataFormData) => {
    onSave({
      infinitive: data.infinitive.trim(),
      infinitiveEn: data.infinitiveEn.trim(),
      aspect: data.aspect,
      aspectPair: data.aspectPair.trim() || undefined,
      verbClass: data.verbClass,
      isIrregular: data.isIrregular,
      isReflexive: data.isReflexive,
      conjugations: editConjugations,
    });
    handleClose();
  };

  const handleDelete = () => {
    if (
      onDelete &&
      window.confirm('Delete this verb and all its conjugation forms? This affects all users.')
    ) {
      onDelete();
      handleClose();
    }
  };

  const activeTenses = (Object.keys(editConjugations) as Tense[]).filter(
    (t) => editConjugations[t]
  );

  return (
    <ModalDialog $maxWidth={700} $maxHeight="90vh" open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Verb</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        {verb && (
          <>
            <AudioRegenerator
              text={infinitiveText}
              type="verb-infinitive"
              id={verb.id}
              currentAudioUrl={pendingAudioUrl || verb.infinitiveAudioUrl}
              onAudioSaved={handleAudioSaved}
              label="Infinitive Audio"
            />
            <Divider sx={{ my: 1 }} />
          </>
        )}

        <VerbDetailsFields control={control} names={VERB_FIELD_NAMES} autoFocus withPlaceholders />

        <FormTextField
          name="aspectPair"
          control={control}
          label="Aspect Pair (optional)"
          placeholder="e.g., zrobić"
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormYesNoField name="isIrregular" control={control} label="Irregular" />
          <FormYesNoField
            name="isReflexive"
            control={control}
            label="Reflexive"
            yesLabel="Yes (się)"
          />
        </Box>

        {activeTenses.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Conjugations
            </Typography>

            {activeTenses.map((tense) => {
              const tenseForms = editConjugations[tense] as
                | Record<string, ConjugationForm>
                | undefined;
              if (!tenseForms) return null;
              const formKeys = TENSE_FORM_KEYS[tense];

              return (
                <Accordion key={tense} disableGutters sx={{ '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" fontWeight={500}>
                      {TENSE_LABELS[tense]}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({formKeys.length} forms)
                      </Typography>
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <FormRow sx={{ mb: 0.5 }}>
                      <FormKeyLabel variant="caption" color="text.disabled" />
                      <Typography variant="caption" color="text.disabled" sx={{ flex: 1 }}>
                        Polish
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ flex: 1.5 }}>
                        English (comma-separated)
                      </Typography>
                      <Box sx={{ width: 32 }} />
                    </FormRow>
                    {formKeys.map((fk) => {
                      const form = tenseForms[fk];
                      if (!form) return null;
                      return (
                        <FormRow key={fk}>
                          <FormKeyLabel variant="caption">{fk}</FormKeyLabel>
                          <TextField
                            size="small"
                            value={form.pl}
                            onChange={(e) => updateFormField(tense, fk, 'pl', e.target.value)}
                            sx={{ flex: 1 }}
                            slotProps={{ htmlInput: { style: { fontSize: '0.8125rem' } } }}
                          />
                          <TextField
                            size="small"
                            value={form.en.join(', ')}
                            onChange={(e) => updateFormField(tense, fk, 'en', e.target.value)}
                            sx={{ flex: 1.5 }}
                            slotProps={{ htmlInput: { style: { fontSize: '0.8125rem' } } }}
                          />
                          {verb && (
                            <InlineAudioRegenerator
                              text={form.pl}
                              type="conjugation"
                              id={verb.id}
                              subPath={`${verb.id}_${tense}_${fk}`}
                              currentAudioUrl={form.audioUrl}
                              onAudioSaved={(url) => handleFormAudioSaved(tense, fk, url)}
                            />
                          )}
                        </FormRow>
                      );
                    })}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </>
        )}
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

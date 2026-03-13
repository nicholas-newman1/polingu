import { useState, useCallback, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import { useBackClose } from '../hooks/useBackClose';
import { AudioRegenerator, InlineAudioRegenerator } from './AudioRegenerator';
import type { Verb, Aspect, VerbClass, Tense, ConjugationForm } from '../types/conjugation';
import {
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  TENSE_LABELS,
  PRESENT_FORM_KEYS,
  PAST_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  CONDITIONAL_FORM_KEYS,
} from '../types/conjugation';

const TENSE_FORM_KEYS: Record<Tense, readonly string[]> = {
  present: PRESENT_FORM_KEYS,
  past: PAST_FORM_KEYS,
  future: FUTURE_FORM_KEYS,
  imperative: IMPERATIVE_FORM_KEYS,
  conditional: CONDITIONAL_FORM_KEYS,
};

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 700,
    margin: theme.spacing(2),
    maxHeight: '90vh',
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Content = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const Actions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
  justifyContent: 'space-between',
}));

const RightActions = styled(Box)({
  display: 'flex',
  gap: 8,
});

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
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [editConjugations, setEditConjugations] = useState<Verb['conjugations']>({});

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

  useEffect(() => {
    if (verb) {
      setEditConjugations(JSON.parse(JSON.stringify(verb.conjugations)));
    } else {
      setEditConjugations({});
    }
  }, [verb]);

  const handleClose = () => {
    reset(getDefaultValues(null));
    setPendingAudioUrl(null);
    setEditConjugations({});
    onClose();
  };

  const handleAudioSaved = (audioUrl: string) => {
    setPendingAudioUrl(audioUrl);
    onAudioUpdated?.(audioUrl);
  };

  useBackClose(open, handleClose);

  const updateFormField = useCallback(
    (tense: Tense, formKey: string, field: 'pl' | 'en', value: string) => {
      setEditConjugations((prev) => {
        const updated = { ...prev };
        const tenseForms = updated[tense];
        if (!tenseForms) return prev;
        const currentForm = (tenseForms as Record<string, ConjugationForm>)[formKey];
        if (!currentForm) return prev;

        const updatedForm: ConjugationForm =
          field === 'pl'
            ? { ...currentForm, pl: value }
            : {
                ...currentForm,
                en: value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              };

        (updated[tense] as Record<string, ConjugationForm>) = {
          ...(tenseForms as Record<string, ConjugationForm>),
          [formKey]: updatedForm,
        };
        return updated;
      });
    },
    []
  );

  const handleFormAudioSaved = useCallback((tense: Tense, formKey: string, audioUrl: string) => {
    setEditConjugations((prev) => {
      const updated = { ...prev };
      const tenseForms = updated[tense];
      if (!tenseForms) return prev;
      const currentForm = (tenseForms as Record<string, ConjugationForm>)[formKey];
      if (!currentForm) return prev;

      (updated[tense] as Record<string, ConjugationForm>) = {
        ...(tenseForms as Record<string, ConjugationForm>),
        [formKey]: { ...currentForm, audioUrl },
      };
      return updated;
    });
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
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Verb</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
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

        <Controller
          name="infinitive"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Polish Infinitive"
              fullWidth
              autoFocus
              required
              placeholder="e.g., robić"
            />
          )}
        />

        <Controller
          name="infinitiveEn"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="English Infinitive"
              fullWidth
              required
              placeholder="e.g., to do"
            />
          )}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Controller
            name="aspect"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <FormControl fullWidth required>
                <InputLabel>Aspect</InputLabel>
                <Select {...field} label="Aspect">
                  {ALL_ASPECTS.map((a) => (
                    <MenuItem key={a} value={a}>
                      {a}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          <Controller
            name="verbClass"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <FormControl fullWidth required>
                <InputLabel>Verb Class</InputLabel>
                <Select {...field} label="Verb Class">
                  {ALL_VERB_CLASSES.map((vc) => (
                    <MenuItem key={vc} value={vc}>
                      {vc}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Box>

        <Controller
          name="aspectPair"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Aspect Pair (optional)"
              fullWidth
              placeholder="e.g., zrobić"
            />
          )}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Controller
            name="isIrregular"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Irregular</InputLabel>
                <Select
                  value={field.value ? 'yes' : 'no'}
                  onChange={(e) => field.onChange(e.target.value === 'yes')}
                  label="Irregular"
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            )}
          />

          <Controller
            name="isReflexive"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Reflexive</InputLabel>
                <Select
                  value={field.value ? 'yes' : 'no'}
                  onChange={(e) => field.onChange(e.target.value === 'yes')}
                  label="Reflexive"
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes (się)</MenuItem>
                </Select>
              </FormControl>
            )}
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
      </Content>
      <Actions>
        <Box>
          {onDelete && (
            <Button onClick={handleDelete} color="error" startIcon={<DeleteIcon />}>
              Delete Verb
            </Button>
          )}
        </Box>
        <RightActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={!isValid}>
            Save Changes
          </Button>
        </RightActions>
      </Actions>
    </StyledDialog>
  );
}

import { useState } from 'react';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
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
  Typography,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';
import { useBackClose } from '../hooks/useBackClose';
import { useAuthContext } from '../hooks/useAuthContext';
import { AudioRegenerator } from './AudioRegenerator';
import type { DrillableForm, ConjugationForm, Aspect, VerbClass } from '../types/conjugation';
import { ALL_ASPECTS, ALL_VERB_CLASSES, TENSE_LABELS } from '../types/conjugation';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 500,
    margin: theme.spacing(2),
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
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);

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

  const handleClose = () => {
    reset(getDefaultValues(null));
    setPendingAudioUrl(null);
    onClose();
  };

  const handleAudioSaved = (audioUrl: string) => {
    setPendingAudioUrl(audioUrl);
    onAudioUpdated?.(audioUrl);
    handleClose();
  };

  useBackClose(open, handleClose);

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
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Edit Conjugation</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
        {form && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tenseLabel} · {personLabel}
            {genderLabel}
          </Typography>
        )}

        <SectionLabel>Verb Details</SectionLabel>

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

        <Controller
          name="pl"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Polish Form"
              fullWidth
              required
              placeholder="e.g., robię"
            />
          )}
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

        <Controller
          name="en"
          control={control}
          rules={{ required: true, validate: (v) => v.trim().length > 0 }}
          render={({ field }) => (
            <TextField
              {...field}
              label="English Translations"
              fullWidth
              required
              multiline
              rows={2}
              placeholder="Comma-separated, e.g., I do, I am doing, I make"
              helperText="Separate multiple translations with commas"
            />
          )}
        />
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

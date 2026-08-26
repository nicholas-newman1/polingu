import { useRef, useState, useCallback } from 'react';
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
  CircularProgress,
  InputAdornment,
  Checkbox,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { generateExample, type GeneratedExample } from '../lib/generateExample';
import { useAuthContext } from '../hooks/useAuthContext';
import { useBackClose } from '../hooks/useBackClose';
import {
  useSinglePolishEnglishAutoTranslate,
  usePolishEnglishAutoTranslate,
} from '../hooks/usePolishEnglishAutoTranslate';
import { normalizeCustomVocabularyFields } from '../lib/utils/normalizeCustomVocabularyFields';
import { AudioRegenerator } from './AudioRegenerator';
import type {
  CustomVocabularyWord,
  VocabularyWord,
  PartOfSpeech,
  NounGender,
  ExampleSentence,
} from '../types/vocabulary';

const PARTS_OF_SPEECH: PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'particle',
  'numeral',
  'proper noun',
];

const GENDERS: NounGender[] = ['masculine', 'feminine', 'neuter'];

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
}));

const ExamplesSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

const ExamplePair = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.02),
  border: `1px solid ${theme.palette.divider}`,
}));

const ExampleHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const AddExampleButton = styled(Button)(({ theme }) => ({
  alignSelf: 'flex-start',
  textTransform: 'none',
  color: theme.palette.text.secondary,
}));

const GenerateSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const GenerateActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const GeneratedPreview = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.success.main, 0.08),
  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
}));

const PreviewActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

interface FieldEndAdornmentProps {
  value: string;
  onClear: () => void;
  clearLabel: string;
  dataQa: string;
  isTranslating?: boolean;
}

function FieldEndAdornment({
  value,
  onClear,
  clearLabel,
  dataQa,
  isTranslating,
}: FieldEndAdornmentProps) {
  const showClear = value.length > 0;
  if (!showClear && !isTranslating) return null;

  return (
    <InputAdornment position="end">
      {isTranslating && <CircularProgress size={16} />}
      {showClear && (
        <IconButton
          size="small"
          edge="end"
          onClick={onClear}
          aria-label={clearLabel}
          data-qa={dataQa}
          tabIndex={-1}
          sx={{ color: 'text.disabled' }}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
    </InputAdornment>
  );
}

interface FormData {
  polish: string;
  english: string;
  partOfSpeech: PartOfSpeech | '';
  gender: NounGender | '';
  notes: string;
  examples: ExampleSentence[];
}

type SaveResult = void | boolean | Promise<void | boolean>;

interface AddVocabularyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (word: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => SaveResult;
  editWord?: CustomVocabularyWord | VocabularyWord | null;
  initialValues?: { polish: string; english: string };
  onAudioUpdated?: (audioUrl: string) => void;
}

const ensureExampleIds = (examples: ExampleSentence[]): ExampleSentence[] =>
  examples.map((ex) => (ex.id ? ex : { ...ex, id: crypto.randomUUID() }));

const getDefaultValues = (
  editWord?: CustomVocabularyWord | VocabularyWord | null,
  initialValues?: { polish: string; english: string }
): FormData => {
  if (editWord) {
    return {
      polish: editWord.polish || '',
      english: editWord.english || '',
      partOfSpeech: editWord.partOfSpeech || '',
      gender: editWord.gender || '',
      notes: editWord.notes || '',
      examples: ensureExampleIds(editWord.examples || []),
    };
  }
  if (initialValues) {
    return {
      polish: initialValues.polish || '',
      english: initialValues.english || '',
      partOfSpeech: '',
      gender: '',
      notes: '',
      examples: [],
    };
  }
  return {
    polish: '',
    english: '',
    partOfSpeech: '',
    gender: '',
    notes: '',
    examples: [],
  };
};

export function AddVocabularyModal({
  open,
  onClose,
  onSave,
  editWord,
  initialValues,
  onAudioUpdated,
}: AddVocabularyModalProps) {
  const { isAdmin } = useAuthContext();
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);

  const hasPrefilledValues = Boolean(
    editWord || initialValues?.polish?.trim() || initialValues?.english?.trim()
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isValid, isSubmitting },
  } = useForm<FormData>({
    values: getDefaultValues(editWord, initialValues),
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'examples',
  });

  const partOfSpeech = useWatch({ control, name: 'partOfSpeech' });
  const polishWord = useWatch({ control, name: 'polish' });
  const englishWord = useWatch({ control, name: 'english' });
  const gender = useWatch({ control, name: 'gender' });
  const showGenderField = partOfSpeech === 'noun' || partOfSpeech === 'proper noun';

  const newExamplePolishRef = useRef<HTMLInputElement>(null);

  const {
    handlePolishChange: handleWordPolishChange,
    handleEnglishChange: handleWordEnglishChange,
    isTranslatingEnglish: isTranslatingWordEnglish,
    isTranslatingPolish: isTranslatingWordPolish,
    cancel: cancelWordTranslations,
  } = useSinglePolishEnglishAutoTranslate({
    getPolish: () => getValues('polish'),
    getEnglish: () => getValues('english'),
    onPolishTranslated: (polish) => setValue('polish', polish, { shouldValidate: true }),
    onEnglishTranslated: (english) => setValue('english', english, { shouldValidate: true }),
  });

  const {
    handlePolishChange: handleExamplePolishChange,
    handleEnglishChange: handleExampleEnglishChange,
    isTranslatingEnglish: isTranslatingExampleEnglish,
    isTranslatingPolish: isTranslatingExamplePolish,
    cancelAll: cancelExampleTranslations,
  } = usePolishEnglishAutoTranslate<number>({
    getPolish: (index) => getValues(`examples.${index}.polish`),
    getEnglish: (index) => getValues(`examples.${index}.english`),
    onPolishTranslated: (index, polish) => setValue(`examples.${index}.polish`, polish),
    onEnglishTranslated: (index, english) => setValue(`examples.${index}.english`, english),
  });

  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExamples, setGeneratedExamples] = useState<GeneratedExample[]>([]);
  const [selectedExampleIndexes, setSelectedExampleIndexes] = useState<Set<number>>(new Set());
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerateExample = useCallback(async () => {
    if (!polishWord?.trim() || !englishWord?.trim()) return;

    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedExamples([]);
    setSelectedExampleIndexes(new Set());

    try {
      const result = await generateExample({
        polish: polishWord.trim(),
        english: englishWord.trim(),
        partOfSpeech: partOfSpeech || undefined,
        gender: gender || undefined,
        context: aiContext.trim() || undefined,
      });
      setGeneratedExamples(result.examples);
      setSelectedExampleIndexes(new Set(result.examples.map((_, i) => i)));
    } catch (error) {
      console.error('Failed to generate example:', error);
      setGenerateError('Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [polishWord, englishWord, partOfSpeech, gender, aiContext]);

  const handleToggleExample = useCallback((index: number) => {
    setSelectedExampleIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleAcceptSelected = useCallback(() => {
    const selected = generatedExamples
      .filter((_, i) => selectedExampleIndexes.has(i))
      .map(({ polish, english }) => ({ id: crypto.randomUUID(), polish, english }));

    selected.forEach((ex) => append(ex));
    setGeneratedExamples([]);
    setSelectedExampleIndexes(new Set());
    setAiContext('');
  }, [generatedExamples, selectedExampleIndexes, append]);

  const handleClose = useCallback(() => {
    reset(getDefaultValues(null, undefined));
    cancelWordTranslations();
    cancelExampleTranslations();
    setAiContext('');
    setGeneratedExamples([]);
    setSelectedExampleIndexes(new Set());
    setGenerateError(null);
    setIsGenerating(false);
    setPendingAudioUrl(null);
    onClose();
  }, [onClose, reset, cancelWordTranslations, cancelExampleTranslations]);

  const handleAudioSaved = useCallback(
    (audioUrl: string) => {
      setPendingAudioUrl(audioUrl);
      onAudioUpdated?.(audioUrl);
      handleClose();
    },
    [onAudioUpdated, handleClose]
  );

  useBackClose(open, handleClose);

  const onSubmit = async (data: FormData) => {
    const validExamples = data.examples.filter((ex) => ex.polish.trim() && ex.english.trim());

    const result = await onSave(
      normalizeCustomVocabularyFields({
        polish: data.polish.trim(),
        english: data.english.trim(),
        partOfSpeech: data.partOfSpeech || undefined,
        gender: showGenderField && data.gender ? data.gender : undefined,
        notes: data.notes.trim() || undefined,
        examples: validExamples.length > 0 ? validExamples : undefined,
      })
    );
    if (result === false) return;
    handleClose();
  };

  const handleAddExample = () => {
    append({ id: crypto.randomUUID(), polish: '', english: '' });
    setTimeout(() => {
      newExamplePolishRef.current?.focus();
    }, 0);
  };

  return (
    <StyledDialog open={open} onClose={handleClose}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>
          {editWord ? 'Edit Word' : 'Add New Word'}
        </DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Content>
          {isAdmin && editWord && 'id' in editWord && (
            <>
              <AudioRegenerator
                text={polishWord}
                type={editWord.isCustom ? 'custom-vocabulary' : 'vocabulary'}
                id={String(editWord.id)}
                currentAudioUrl={
                  pendingAudioUrl || ('audioUrl' in editWord ? editWord.audioUrl : undefined)
                }
                onAudioSaved={handleAudioSaved}
                label="Word Audio"
              />
              <Divider sx={{ my: 1 }} />
            </>
          )}

          <Controller
            name="polish"
            control={control}
            rules={{ required: true, validate: (v) => v.trim().length > 0 }}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  handleWordPolishChange(e.target.value);
                }}
                label="Polish"
                fullWidth
                autoFocus={!hasPrefilledValues}
                required
                placeholder="e.g., kot"
                slotProps={{
                  input: {
                    endAdornment: (
                      <FieldEndAdornment
                        value={field.value}
                        onClear={() => {
                          field.onChange('');
                          handleWordPolishChange('');
                        }}
                        clearLabel="Clear Polish"
                        dataQa="add-vocabulary-clear-polish"
                        isTranslating={isTranslatingWordPolish}
                      />
                    ),
                  },
                }}
              />
            )}
          />

          <Controller
            name="english"
            control={control}
            rules={{ required: true, validate: (v) => v.trim().length > 0 }}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  handleWordEnglishChange(e.target.value);
                }}
                label="English"
                fullWidth
                required
                placeholder="e.g., cat"
                slotProps={{
                  input: {
                    endAdornment: (
                      <FieldEndAdornment
                        value={field.value}
                        onClear={() => {
                          field.onChange('');
                          handleWordEnglishChange('');
                        }}
                        clearLabel="Clear English"
                        dataQa="add-vocabulary-clear-english"
                        isTranslating={isTranslatingWordEnglish}
                      />
                    ),
                  },
                }}
              />
            )}
          />

          <Controller
            name="partOfSpeech"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Part of Speech (optional)</InputLabel>
                <Select
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    if (e.target.value !== 'noun' && e.target.value !== 'proper noun') {
                      setValue('gender', '');
                    }
                  }}
                  label="Part of Speech (optional)"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {PARTS_OF_SPEECH.map((pos) => (
                    <MenuItem key={pos} value={pos}>
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          {showGenderField && (
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Gender (optional)</InputLabel>
                  <Select {...field} label="Gender (optional)">
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {GENDERS.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          )}

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Notes (optional)"
                fullWidth
                multiline
                rows={2}
                placeholder="Any additional notes..."
              />
            )}
          />

          <ExamplesSection>
            <Typography variant="body2" color="text.secondary">
              Example Sentences (optional)
            </Typography>

            {fields.map((field, index) => (
              <ExamplePair key={field.id}>
                <ExampleHeader>
                  <Typography variant="caption" color="text.disabled">
                    Example {index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      cancelExampleTranslations();
                      remove(index);
                    }}
                    aria-label="remove example"
                    sx={{ color: 'text.disabled' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </ExampleHeader>
                <Controller
                  name={`examples.${index}.polish`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleExamplePolishChange(index, e.target.value);
                      }}
                      inputRef={index === fields.length - 1 ? newExamplePolishRef : undefined}
                      label="Polish"
                      size="small"
                      fullWidth
                      placeholder="e.g., Mam czarnego kota."
                      slotProps={{
                        input: {
                          endAdornment: (
                            <FieldEndAdornment
                              value={field.value}
                              onClear={() => {
                                field.onChange('');
                                handleExamplePolishChange(index, '');
                              }}
                              clearLabel={`Clear example ${index + 1} Polish`}
                              dataQa="add-vocabulary-clear-example-polish"
                              isTranslating={isTranslatingExamplePolish(index)}
                            />
                          ),
                        },
                      }}
                    />
                  )}
                />
                <Controller
                  name={`examples.${index}.english`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleExampleEnglishChange(index, e.target.value);
                      }}
                      label="English"
                      size="small"
                      fullWidth
                      placeholder="e.g., I have a black cat."
                      slotProps={{
                        input: {
                          endAdornment: (
                            <FieldEndAdornment
                              value={field.value}
                              onClear={() => {
                                field.onChange('');
                                handleExampleEnglishChange(index, '');
                              }}
                              clearLabel={`Clear example ${index + 1} English`}
                              dataQa="add-vocabulary-clear-example-english"
                              isTranslating={isTranslatingExampleEnglish(index)}
                            />
                          ),
                        },
                      }}
                    />
                  )}
                />
              </ExamplePair>
            ))}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <AddExampleButton
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddExample}
                type="button"
              >
                Add manually
              </AddExampleButton>
            </Box>

            {isAdmin && (
              <Box>
                <GenerateSection>
                  <TextField
                    size="small"
                    label="Context (optional)"
                    placeholder="e.g., restaurant scenario, formal letter, casual conversation..."
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    fullWidth
                  />

                  {generateError && (
                    <Typography variant="caption" color="error">
                      {generateError}
                    </Typography>
                  )}

                  {generatedExamples.length > 0 ? (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {generatedExamples.map((example, index) => (
                          <GeneratedPreview
                            key={index}
                            sx={{
                              opacity: selectedExampleIndexes.has(index) ? 1 : 0.5,
                              cursor: 'pointer',
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              gap: 1,
                            }}
                            onClick={() => handleToggleExample(index)}
                          >
                            <Checkbox
                              checked={selectedExampleIndexes.has(index)}
                              size="small"
                              sx={{ p: 0, mt: 0.25 }}
                              tabIndex={-1}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={500}>
                                {example.polish}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {example.english}
                              </Typography>
                              {example.meaning && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'primary.main',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  ({example.meaning})
                                </Typography>
                              )}
                            </Box>
                          </GeneratedPreview>
                        ))}
                      </Box>
                      <PreviewActions>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleAcceptSelected}
                          disabled={selectedExampleIndexes.size === 0}
                        >
                          Accept Selected ({selectedExampleIndexes.size})
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={handleGenerateExample}
                          disabled={isGenerating}
                        >
                          Regenerate
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => {
                            setGeneratedExamples([]);
                            setSelectedExampleIndexes(new Set());
                          }}
                        >
                          Discard
                        </Button>
                      </PreviewActions>
                    </>
                  ) : (
                    <GenerateActions>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={
                          isGenerating ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <AutoAwesomeIcon />
                          )
                        }
                        onClick={handleGenerateExample}
                        disabled={isGenerating}
                      >
                        {isGenerating ? 'Generating...' : 'Generate with AI'}
                      </Button>
                    </GenerateActions>
                  )}
                </GenerateSection>
              </Box>
            )}
          </ExamplesSection>
        </Content>
        <Actions>
          <Button onClick={handleClose} color="inherit" type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Saving...' : editWord ? 'Save Changes' : 'Add Word'}
          </Button>
        </Actions>
      </form>
    </StyledDialog>
  );
}

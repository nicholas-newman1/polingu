import { useRef, useState, useCallback, useEffect } from 'react';
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
  Collapse,
  Checkbox,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { translate } from '../lib/translate';
import { generateExample, type GeneratedExample } from '../lib/generateExample';
import { useAuthContext } from '../hooks/useAuthContext';
import { useBackClose } from '../hooks/useBackClose';
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
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
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

interface FormData {
  polish: string;
  english: string;
  partOfSpeech: PartOfSpeech | '';
  gender: NounGender | '';
  notes: string;
  examples: ExampleSentence[];
}

interface AddVocabularyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    word: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => void;
  editWord?: CustomVocabularyWord | VocabularyWord | null;
}

const getDefaultValues = (
  editWord?: CustomVocabularyWord | VocabularyWord | null
): FormData => ({
  polish: editWord?.polish || '',
  english: editWord?.english || '',
  partOfSpeech: editWord?.partOfSpeech || '',
  gender: editWord?.gender || '',
  notes: editWord?.notes || '',
  examples: editWord?.examples || [],
});

export function AddVocabularyModal({
  open,
  onClose,
  onSave,
  editWord,
}: AddVocabularyModalProps) {
  const { isAdmin } = useAuthContext();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(editWord),
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
  const showGenderField =
    partOfSpeech === 'noun' || partOfSpeech === 'proper noun';

  const newExamplePolishRef = useRef<HTMLInputElement>(null);
  const [translatingIndexes, setTranslatingIndexes] = useState<Set<number>>(
    new Set()
  );
  const translationTimeouts = useRef<
    Map<number, ReturnType<typeof setTimeout>>
  >(new Map());
  const userEditedEnglish = useRef<Set<number>>(new Set());

  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExamples, setGeneratedExamples] = useState<
    GeneratedExample[]
  >([]);
  const [selectedExampleIndexes, setSelectedExampleIndexes] = useState<
    Set<number>
  >(new Set());
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    const timeouts = translationTimeouts.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const translatePolishText = useCallback(
    async (index: number, polishText: string) => {
      const trimmed = polishText.trim();
      if (!trimmed) return;

      setTranslatingIndexes((prev) => new Set(prev).add(index));
      try {
        const result = await translate(trimmed, 'EN');
        if (!userEditedEnglish.current.has(index)) {
          setValue(`examples.${index}.english`, result.translatedText);
        }
      } catch {
        // Silently fail - user can manually enter translation
      } finally {
        setTranslatingIndexes((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [setValue]
  );

  const handlePolishChange = useCallback(
    (index: number, value: string) => {
      userEditedEnglish.current.delete(index);

      const existingTimeout = translationTimeouts.current.get(index);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        translatePolishText(index, value);
        translationTimeouts.current.delete(index);
      }, 500);

      translationTimeouts.current.set(index, timeout);
    },
    [translatePolishText]
  );

  const handleEnglishManualEdit = useCallback((index: number) => {
    userEditedEnglish.current.add(index);
  }, []);

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
      .map(({ polish, english }) => ({ polish, english }));

    selected.forEach((ex) => append(ex));
    setGeneratedExamples([]);
    setSelectedExampleIndexes(new Set());
    setShowAiGenerate(false);
    setAiContext('');
  }, [generatedExamples, selectedExampleIndexes, append]);

  const handleClose = useCallback(() => {
    reset(getDefaultValues(null));
    translationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    translationTimeouts.current.clear();
    userEditedEnglish.current.clear();
    setTranslatingIndexes(new Set());
    setShowAiGenerate(false);
    setAiContext('');
    setGeneratedExamples([]);
    setSelectedExampleIndexes(new Set());
    setGenerateError(null);
    setIsGenerating(false);
    onClose();
  }, [onClose, reset]);

  useBackClose(open, handleClose);

  const onSubmit = (data: FormData) => {
    const validExamples = data.examples.filter(
      (ex) => ex.polish.trim() && ex.english.trim()
    );

    onSave({
      polish: data.polish.trim(),
      english: data.english.trim(),
      partOfSpeech: data.partOfSpeech || undefined,
      gender: showGenderField && data.gender ? data.gender : undefined,
      notes: data.notes.trim() || undefined,
      examples: validExamples.length > 0 ? validExamples : undefined,
    });
    handleClose();
  };

  const handleAddExample = () => {
    append({ polish: '', english: '' });
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
          <Controller
            name="polish"
            control={control}
            rules={{ required: true, validate: (v) => v.trim().length > 0 }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Polish"
                fullWidth
                autoFocus
                required
                placeholder="e.g., kot"
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
                label="English"
                fullWidth
                required
                placeholder="e.g., cat"
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
                    if (
                      e.target.value !== 'noun' &&
                      e.target.value !== 'proper noun'
                    ) {
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
                      const timeout = translationTimeouts.current.get(index);
                      if (timeout) {
                        clearTimeout(timeout);
                        translationTimeouts.current.delete(index);
                      }
                      userEditedEnglish.current.delete(index);
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
                        handlePolishChange(index, e.target.value);
                      }}
                      inputRef={
                        index === fields.length - 1
                          ? newExamplePolishRef
                          : undefined
                      }
                      label="Polish"
                      size="small"
                      fullWidth
                      placeholder="e.g., Mam czarnego kota."
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
                        handleEnglishManualEdit(index);
                      }}
                      label="English"
                      size="small"
                      fullWidth
                      placeholder="e.g., I have a black cat."
                      slotProps={{
                        input: {
                          endAdornment: translatingIndexes.has(index) ? (
                            <InputAdornment position="end">
                              <CircularProgress size={16} />
                            </InputAdornment>
                          ) : null,
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

              {isAdmin && (
                <AddExampleButton
                  size="small"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => setShowAiGenerate(!showAiGenerate)}
                  type="button"
                  disabled={!polishWord?.trim() || !englishWord?.trim()}
                >
                  Generate with AI
                </AddExampleButton>
              )}
            </Box>

            {isAdmin && (
              <Collapse in={showAiGenerate}>
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
                              opacity: selectedExampleIndexes.has(index)
                                ? 1
                                : 0.5,
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
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
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
                        {isGenerating ? 'Generating...' : 'Generate'}
                      </Button>
                    </GenerateActions>
                  )}
                </GenerateSection>
              </Collapse>
            )}
          </ExamplesSection>
        </Content>
        <Actions>
          <Button onClick={handleClose} color="inherit" type="button">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!isValid}>
            {editWord ? 'Save Changes' : 'Add Word'}
          </Button>
        </Actions>
      </form>
    </StyledDialog>
  );
}

import { useRef, type Ref } from 'react';
import { useForm, Controller, useFieldArray, useWatch, type Control } from 'react-hook-form';
import {
  DialogTitle,
  IconButton,
  TextField,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { styled } from '../lib/styled';
import {
  ModalDialog,
  ModalHeader,
  ModalContent,
  ModalActions,
  ExamplePairBox,
  ExampleRowHeader,
} from './modalStyles';
import { useAuthContext } from '../hooks/useAuthContext';
import { useEditModalClose } from '../hooks/useEditModalClose';
import {
  usePolishEnglishFormAutoTranslate,
  usePolishEnglishAutoTranslate,
} from '../hooks/usePolishEnglishAutoTranslate';
import { normalizeCustomVocabularyFields } from '../lib/utils/normalizeCustomVocabularyFields';
import { AudioRegenerator } from './AudioRegenerator';
import { AiExampleGenerator } from './AiExampleGenerator';
import { FieldEndAdornment } from './FieldEndAdornment';
import { FormTextField } from './FormFields';
import { PolishEnglishFields } from './PolishEnglishFields';
import { renderSelectOptions } from './selectOptions';
import capitalize from '../lib/utils/capitalize';
import {
  PARTS_OF_SPEECH,
  NOUN_GENDERS,
  type CustomVocabularyWord,
  type VocabularyWord,
  type PartOfSpeech,
  type NounGender,
  type ExampleSentence,
} from '../types/vocabulary';

const ExamplesSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

const AddExampleButton = styled(Button)(({ theme }) => ({
  alignSelf: 'flex-start',
  textTransform: 'none',
  color: theme.palette.text.secondary,
}));

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

const hasPrefilled = (
  editWord: AddVocabularyModalProps['editWord'],
  initialValues: AddVocabularyModalProps['initialValues']
) => Boolean(editWord || initialValues?.polish?.trim() || initialValues?.english?.trim());

const toGenerateRequest = ({
  polish,
  english,
  partOfSpeech,
  gender,
}: Pick<FormData, 'polish' | 'english' | 'partOfSpeech' | 'gender'>) => {
  const trimmedPolish = polish?.trim();
  const trimmedEnglish = english?.trim();
  if (!trimmedPolish || !trimmedEnglish) return null;
  return {
    polish: trimmedPolish,
    english: trimmedEnglish,
    partOfSpeech: partOfSpeech || undefined,
    gender: gender || undefined,
  };
};

interface WordAudioSectionProps {
  word: CustomVocabularyWord | VocabularyWord;
  text: string;
  pendingAudioUrl: string | null;
  onAudioSaved: (audioUrl: string) => void;
}

function WordAudioSection({ word, text, pendingAudioUrl, onAudioSaved }: WordAudioSectionProps) {
  return (
    <>
      <AudioRegenerator
        text={text}
        type={word.isCustom ? 'custom-vocabulary' : 'vocabulary'}
        id={String(word.id)}
        currentAudioUrl={pendingAudioUrl || ('audioUrl' in word ? word.audioUrl : undefined)}
        onAudioSaved={onAudioSaved}
        label="Word Audio"
      />
      <Divider sx={{ my: 1 }} />
    </>
  );
}

type ExampleTranslation = ReturnType<typeof usePolishEnglishAutoTranslate<number>>;

const EXAMPLE_FIELDS = {
  polish: { label: 'Polish', placeholder: 'e.g., Mam czarnego kota.' },
  english: { label: 'English', placeholder: 'e.g., I have a black cat.' },
} as const;

interface ExampleFieldProps {
  control: Control<FormData>;
  index: number;
  lang: keyof typeof EXAMPLE_FIELDS;
  translation: ExampleTranslation;
  inputRef?: Ref<HTMLInputElement>;
}

function ExampleField({ control, index, lang, translation, inputRef }: ExampleFieldProps) {
  const isPolish = lang === 'polish';
  const handleChange = isPolish ? translation.handlePolishChange : translation.handleEnglishChange;
  const handleBlur = isPolish ? translation.handlePolishBlur : translation.handleEnglishBlur;
  const isTranslating = isPolish
    ? translation.isTranslatingPolish
    : translation.isTranslatingEnglish;
  const { label, placeholder } = EXAMPLE_FIELDS[lang];

  return (
    <Controller
      name={`examples.${index}.${lang}`}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          onChange={(e) => {
            field.onChange(e);
            handleChange(index, e.target.value);
          }}
          onBlur={() => {
            field.onBlur();
            handleBlur(index);
          }}
          inputRef={inputRef}
          label={label}
          size="small"
          fullWidth
          placeholder={placeholder}
          slotProps={{
            input: {
              endAdornment: (
                <FieldEndAdornment
                  value={field.value}
                  onClear={() => {
                    field.onChange('');
                    handleChange(index, '');
                  }}
                  clearLabel={`Clear example ${index + 1} ${label}`}
                  dataQa={`add-vocabulary-clear-example-${lang}`}
                  isTranslating={isTranslating(index)}
                />
              ),
            },
          }}
        />
      )}
    />
  );
}

export function AddVocabularyModal({
  open,
  onClose,
  onSave,
  editWord,
  initialValues,
  onAudioUpdated,
}: AddVocabularyModalProps) {
  const { isAdmin } = useAuthContext();

  const hasPrefilledValues = hasPrefilled(editWord, initialValues);

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

  const wordTranslation = usePolishEnglishFormAutoTranslate({ getValues, setValue });
  const exampleTranslation = usePolishEnglishAutoTranslate<number>({
    getPolish: (index) => getValues(`examples.${index}.polish`),
    getEnglish: (index) => getValues(`examples.${index}.english`),
    onPolishTranslated: (index, polish) => setValue(`examples.${index}.polish`, polish),
    onEnglishTranslated: (index, english) => setValue(`examples.${index}.english`, english),
  });

  const { pendingAudioUrl, handleClose, handleAudioSaved } = useEditModalClose({
    open,
    onClose,
    onAudioUpdated,
    resetForm: () => {
      reset(getDefaultValues(null, undefined));
      wordTranslation.cancel();
      exampleTranslation.cancelAll();
    },
  });

  const generateRequest = toGenerateRequest({
    polish: polishWord,
    english: englishWord,
    partOfSpeech,
    gender,
  });

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

  const submitLabel = editWord ? 'Save Changes' : 'Add Word';

  return (
    <ModalDialog open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>
          {editWord ? 'Edit Word' : 'Add New Word'}
        </DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          {isAdmin && editWord && 'id' in editWord && (
            <WordAudioSection
              word={editWord}
              text={polishWord}
              pendingAudioUrl={pendingAudioUrl}
              onAudioSaved={handleAudioSaved}
            />
          )}

          <PolishEnglishFields
            control={control}
            translation={wordTranslation}
            dataQaPrefix="add-vocabulary"
            autoFocus={!hasPrefilledValues}
            placeholders={{ polish: 'e.g., kot', english: 'e.g., cat' }}
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
                  {renderSelectOptions(PARTS_OF_SPEECH, 'None', capitalize)}
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
                    {renderSelectOptions(NOUN_GENDERS, 'None', capitalize)}
                  </Select>
                </FormControl>
              )}
            />
          )}

          <FormTextField
            name="notes"
            control={control}
            label="Notes (optional)"
            multiline
            placeholder="Any additional notes..."
          />

          <ExamplesSection>
            <Typography variant="body2" color="text.secondary">
              Example Sentences (optional)
            </Typography>

            {fields.map((field, index) => (
              <ExamplePairBox key={field.id}>
                <ExampleRowHeader>
                  <Typography variant="caption" color="text.disabled">
                    Example {index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      exampleTranslation.cancelAll();
                      remove(index);
                    }}
                    aria-label="remove example"
                    sx={{ color: 'text.disabled' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </ExampleRowHeader>
                <ExampleField
                  control={control}
                  index={index}
                  lang="polish"
                  translation={exampleTranslation}
                  inputRef={index === fields.length - 1 ? newExamplePolishRef : undefined}
                />
                <ExampleField
                  control={control}
                  index={index}
                  lang="english"
                  translation={exampleTranslation}
                />
              </ExamplePairBox>
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
              <AiExampleGenerator
                request={generateRequest}
                onAccept={(examples) => examples.forEach((ex) => append(ex))}
              />
            )}
          </ExamplesSection>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleClose} color="inherit" type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </ModalActions>
      </form>
    </ModalDialog>
  );
}

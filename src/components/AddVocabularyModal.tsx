import { useId, useState, type ReactNode } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import {
  DialogTitle,
  IconButton,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Divider,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { styled } from '../lib/styled';
import { ModalHeader, ModalContent, ModalActions } from './modalStyles';
import { KeyboardAwareModalDialog } from './KeyboardAwareModalDialog';
import { useAuthContext } from '../contexts/AuthContext';
import { useEditModal } from '../hooks/useEditModal';
import { useExampleRows } from '../hooks/useExampleRows';
import { type ModalSaveResult } from '../hooks/useOptimisticModalSave';
import { usePolishEnglishFormAutoTranslate } from '../hooks/usePolishEnglishAutoTranslate';
import { normalizeCustomVocabularyFields } from '../lib/utils/normalizeCustomVocabularyFields';
import { AudioRegenerator } from './AudioRegenerator';
import { AiExampleGenerator } from './AiExampleGenerator';
import { ExampleRowsEditor } from './ExampleRowsEditor';
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

function VocabularyDetails({ editMode, children }: { editMode: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <>
      {!editMode && (
        <Button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          More details (optional)
        </Button>
      )}
      <Collapse in={editMode || expanded} id={detailsId}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>{children}</Box>
      </Collapse>
    </>
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

interface AddVocabularyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (word: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => ModalSaveResult;
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
  const prefill = editWord ?? initialValues;
  return {
    polish: prefill?.polish || '',
    english: prefill?.english || '',
    partOfSpeech: editWord?.partOfSpeech || '',
    gender: editWord?.gender || '',
    notes: editWord?.notes || '',
    examples: ensureExampleIds(editWord?.examples || []),
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
  onAudioSaved: (audioUrl: string) => void;
}

function WordAudioSection({ word, text, onAudioSaved }: WordAudioSectionProps) {
  return (
    <>
      <AudioRegenerator
        text={text}
        type={word.isCustom ? 'custom-vocabulary' : 'vocabulary'}
        id={String(word.id)}
        currentAudioUrl={'audioUrl' in word ? word.audioUrl : undefined}
        onAudioSaved={onAudioSaved}
        label="Word Audio"
      />
      <Divider sx={{ my: 1 }} />
    </>
  );
}

const EXAMPLE_PLACEHOLDERS = {
  polish: 'e.g., Mam czarnego kota.',
  english: 'e.g., I have a black cat.',
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

  const hasPrefilledValues = hasPrefilled(editWord, initialValues);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setFocus,
    getValues,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(editWord, initialValues),
    mode: 'onChange',
  });

  const partOfSpeech = useWatch({ control, name: 'partOfSpeech' });
  const polishWord = useWatch({ control, name: 'polish' });
  const englishWord = useWatch({ control, name: 'english' });
  const gender = useWatch({ control, name: 'gender' });
  const showGenderField = partOfSpeech === 'noun' || partOfSpeech === 'proper noun';

  const wordTranslation = usePolishEnglishFormAutoTranslate(
    { getValues, setValue },
    { vocabulary: true }
  );
  const exampleRows = useExampleRows({ control, getValues, setValue });

  const { handleClose, handleAudioSaved, save } = useEditModal({
    open,
    onClose,
    onSave,
    onAudioUpdated,
    reset: () => {
      reset(getDefaultValues());
      wordTranslation.cancel();
      exampleRows.translation.cancelAll();
    },
  });

  const generateRequest = toGenerateRequest({
    polish: polishWord,
    english: englishWord,
    partOfSpeech,
    gender,
  });

  const onSubmit = (data: FormData) => {
    const validExamples = data.examples.filter((ex) => ex.polish.trim() && ex.english.trim());

    save(
      normalizeCustomVocabularyFields({
        polish: data.polish.trim(),
        english: data.english.trim(),
        partOfSpeech: data.partOfSpeech || undefined,
        gender: showGenderField && data.gender ? data.gender : undefined,
        notes: data.notes.trim() || undefined,
        examples: validExamples.length > 0 ? validExamples : undefined,
      })
    );
  };

  const submitLabel = editWord ? 'Save Changes' : 'Add Word';

  return (
    <KeyboardAwareModalDialog
      open={open}
      onClose={handleClose}
      slotProps={{
        transition: {
          onEntered: () => {
            if (!hasPrefilledValues) setFocus('polish');
          },
        },
      }}
    >
      <ModalHeader sx={{ flexShrink: 0 }}>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>
          {editWord ? 'Edit Word' : 'Add New Word'}
        </DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <ModalContent>
          {isAdmin && editWord && 'id' in editWord && (
            <WordAudioSection word={editWord} text={polishWord} onAudioSaved={handleAudioSaved} />
          )}

          <PolishEnglishFields
            control={control}
            translation={wordTranslation}
            dataQaPrefix="add-vocabulary"
            autoFocus={!hasPrefilledValues}
            placeholders={{ polish: 'e.g., kot', english: 'e.g., cat' }}
          />

          <VocabularyDetails key={String(open)} editMode={Boolean(editWord)}>
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

              <ExampleRowsEditor
                rows={exampleRows}
                dataQaPrefix="add-vocabulary-example"
                placeholders={EXAMPLE_PLACEHOLDERS}
              />

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <AddExampleButton
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={exampleRows.addEmptyRow}
                  type="button"
                >
                  Add manually
                </AddExampleButton>
              </Box>

              {isAdmin && (
                <AiExampleGenerator request={generateRequest} onAccept={exampleRows.append} />
              )}
            </ExamplesSection>
          </VocabularyDetails>
        </ModalContent>
        <ModalActions sx={{ flexShrink: 0 }}>
          <Button onClick={handleClose} color="inherit" type="button">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!isValid}>
            {submitLabel}
          </Button>
        </ModalActions>
      </Box>
    </KeyboardAwareModalDialog>
  );
}

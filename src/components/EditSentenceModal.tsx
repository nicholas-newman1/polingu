import { useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import {
  DialogTitle,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Alert,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEditModalClose } from '../hooks/useEditModalClose';
import { useReviewData } from '../hooks/useReviewData';
import { useAuthContext } from '../hooks/useAuthContext';
import { usePolishEnglishFormAutoTranslate } from '../hooks/usePolishEnglishAutoTranslate';
import { AudioRegenerator } from './AudioRegenerator';
import { PolishEnglishFields } from './PolishEnglishFields';
import { ModalDialog, ModalHeader, ModalContent } from './modalStyles';
import { ModalFooter } from './ModalFooter';
import { FormSelectField } from './FormFields';
import type { Sentence, CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import { findLinkedVocabularyWord } from '../lib/sentences/findLinkedVocabularyWord';

interface FormData {
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
}

type SaveResult = void | boolean | Promise<void | boolean>;

interface EditSentenceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Sentence, 'id'>) => SaveResult;
  sentence: Sentence | null;
  isCreating?: boolean;
  onAudioUpdated?: (audioUrl: string) => void;
  initialValues?: { polish?: string; english?: string };
}

const getDefaultValues = (
  sentence: Sentence | null,
  initialValues?: { polish?: string; english?: string }
): FormData => ({
  polish: sentence?.polish || initialValues?.polish || '',
  english: sentence?.english || initialValues?.english || '',
  level: sentence?.level || 'A1',
  tags: sentence?.tags || [],
});

export function EditSentenceModal({
  open,
  onClose,
  onSave,
  sentence,
  isCreating = false,
  onAudioUpdated,
  initialValues,
}: EditSentenceModalProps) {
  const { isAdmin } = useAuthContext();
  const { sentenceTags, vocabularyWords } = useReviewData();
  const allTags = [...sentenceTags.topics, ...sentenceTags.grammar, ...sentenceTags.style];

  const linkedVocabularyWord = useMemo(
    () => findLinkedVocabularyWord(sentence, vocabularyWords),
    [sentence, vocabularyWords]
  );

  const showLinkedVocabulary =
    !isCreating && sentence?.source === 'vocab-example' && !!sentence.sourceVocabularyId;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isValid },
  } = useForm<FormData>({
    values: getDefaultValues(sentence, initialValues),
    mode: 'onChange',
  });

  const polishText = useWatch({ control, name: 'polish' });

  const translation = usePolishEnglishFormAutoTranslate({ getValues, setValue });

  const { pendingAudioUrl, handleClose, handleAudioSaved } = useEditModalClose({
    open,
    onClose,
    resetForm: () => {
      reset(getDefaultValues(null));
      translation.cancel();
    },
    onAudioUpdated,
  });

  const onSubmit = async (data: FormData) => {
    const result = await onSave({
      polish: data.polish.trim(),
      english: data.english.trim(),
      level: data.level,
      tags: data.tags,
    });
    if (result === false) return;
    handleClose();
  };

  return (
    <ModalDialog $maxWidth={600} $maxHeight="90vh" open={open} onClose={handleClose}>
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>
          {isCreating ? 'Add Sentence' : 'Edit Sentence'}
        </DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        {showLinkedVocabulary && (
          <Alert severity="info" data-qa="edit-sentence-linked-vocabulary">
            {linkedVocabularyWord ? (
              <Typography variant="body2" component="span" data-qa="edit-sentence-linked-word">
                <strong>Linked word:</strong> {linkedVocabularyWord.polish} ·{' '}
                {linkedVocabularyWord.english}
              </Typography>
            ) : (
              <Typography
                variant="body2"
                component="span"
                data-qa="edit-sentence-linked-word-missing"
              >
                <strong>Linked word:</strong> unavailable (vocabulary entry not found)
              </Typography>
            )}
          </Alert>
        )}

        {isAdmin && sentence && !isCreating && (
          <>
            <AudioRegenerator
              text={polishText}
              type={sentence.isCustom ? 'custom-sentence' : 'sentence'}
              id={sentence.id}
              currentAudioUrl={pendingAudioUrl || sentence.audioUrl}
              onAudioSaved={handleAudioSaved}
              label="Sentence Audio"
            />
            <Divider sx={{ my: 1 }} />
          </>
        )}

        <PolishEnglishFields
          control={control}
          translation={translation}
          dataQaPrefix="edit-sentence"
          autoFocus
          multiline
        />

        <Stack direction="row" spacing={2}>
          <FormSelectField
            name="level"
            control={control}
            label="Level"
            options={ALL_LEVELS}
            required
          />

          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Tags</InputLabel>
                <Select
                  {...field}
                  label="Tags"
                  multiple
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {allTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Stack>
      </ModalContent>
      <ModalFooter
        onCancel={handleClose}
        onSubmit={handleSubmit(onSubmit)}
        submitLabel={isCreating ? 'Add Sentence' : 'Save Changes'}
        submitDisabled={!isValid}
      />
    </ModalDialog>
  );
}

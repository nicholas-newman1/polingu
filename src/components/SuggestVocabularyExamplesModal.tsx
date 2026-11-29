import { useCallback, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { DialogTitle, IconButton, Box, Button, Typography, Skeleton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';
import { ModalDialog, ModalHeader, ModalContent, ModalActions } from './modalStyles';
import { toExampleSentences } from '../lib/generateExample';
import { useExampleRows, type ExampleRowsFormValues } from '../hooks/useExampleRows';
import { useGeneratedExamples } from '../hooks/useGeneratedExamples';
import { useOptimisticModalSave, type ModalSaveResult } from '../hooks/useOptimisticModalSave';
import { ExampleRowsEditor } from './ExampleRowsEditor';
import { GeneratedExampleOptions } from './GeneratedExampleOptions';
import type { ExampleSentence, VocabularyWord } from '../types/vocabulary';

const SUGGESTION_CAP = 3;

const SectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

type GeneratedExamples = ReturnType<typeof useGeneratedExamples>;

const ButtonRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

const MessageBlock = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

function AddManuallyButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="text"
      color="inherit"
      startIcon={<AddIcon />}
      onClick={onClick}
      data-qa="suggest-vocabulary-examples-add-manually"
    >
      Add manually
    </Button>
  );
}

function RegenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<RefreshIcon />}
      onClick={onClick}
      data-qa="suggest-vocabulary-examples-regenerate"
    >
      Regenerate
    </Button>
  );
}

interface SuggestionsBodyProps {
  suggestions: GeneratedExamples;
  hasAccepted: boolean;
  onFetch: () => void;
  onAcceptSelected: () => void;
  onAddManually: () => void;
}

function SuggestionsBody({
  suggestions,
  hasAccepted,
  onFetch,
  onAcceptSelected,
  onAddManually,
}: SuggestionsBodyProps) {
  if (suggestions.isGenerating) {
    return (
      <Stack spacing={1} data-qa="suggest-vocabulary-examples-loading">
        {Array.from({ length: SUGGESTION_CAP }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Stack>
    );
  }

  if (suggestions.error) {
    return (
      <MessageBlock data-qa="suggest-vocabulary-examples-error">
        <Typography variant="body2" color="error">
          {suggestions.error}
        </Typography>
        <ButtonRow>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onFetch}
            data-qa="suggest-vocabulary-examples-retry"
          >
            Try again
          </Button>
          <AddManuallyButton onClick={onAddManually} />
        </ButtonRow>
      </MessageBlock>
    );
  }

  if (suggestions.items.length > 0) {
    const selectedCount = suggestions.selected.size;
    return (
      <Stack spacing={1}>
        <GeneratedExampleOptions
          examples={suggestions.items}
          selected={suggestions.selected}
          onToggle={suggestions.toggle}
          dataQa="suggest-vocabulary-examples-suggestion"
        />
        <ButtonRow sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={onAcceptSelected}
            disabled={selectedCount === 0}
            data-qa="suggest-vocabulary-examples-accept-selected"
          >
            Accept Selected ({selectedCount})
          </Button>
          <RegenerateButton onClick={onFetch} />
          <AddManuallyButton onClick={onAddManually} />
        </ButtonRow>
      </Stack>
    );
  }

  if (hasAccepted) {
    return (
      <ButtonRow>
        <RegenerateButton onClick={onFetch} />
        <AddManuallyButton onClick={onAddManually} />
      </ButtonRow>
    );
  }

  return (
    <MessageBlock data-qa="suggest-vocabulary-examples-empty">
      <Typography variant="body2" color="text.secondary">
        No suggestions to show.
      </Typography>
      <ButtonRow>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={onFetch}
          data-qa="suggest-vocabulary-examples-generate"
        >
          Generate suggestions
        </Button>
        <AddManuallyButton onClick={onAddManually} />
      </ButtonRow>
    </MessageBlock>
  );
}

const NO_EXAMPLES: ExampleRowsFormValues = { examples: [] };

interface SuggestVocabularyExamplesModalProps {
  open: boolean;
  word: VocabularyWord | null;
  onClose: () => void;
  onSave: (examples: ExampleSentence[]) => ModalSaveResult;
}

export function SuggestVocabularyExamplesModal({
  open,
  word,
  onClose,
  onSave,
}: SuggestVocabularyExamplesModalProps) {
  const suggestions = useGeneratedExamples({
    errorMessage: 'Failed to generate suggestions. Please try again.',
    limit: SUGGESTION_CAP,
  });
  const { generate, clear: clearSuggestions, reset: resetSuggestions } = suggestions;

  const { control, getValues, setValue, reset } = useForm<ExampleRowsFormValues>({
    defaultValues: NO_EXAMPLES,
  });
  const acceptedRows = useExampleRows({ control, getValues, setValue });
  const { cancelAll: cancelTranslations } = acceptedRows.translation;
  const acceptedExamples = useWatch({ control, name: 'examples' });

  const fetchSuggestions = useCallback(() => {
    if (!word) return;
    void generate({
      polish: word.polish,
      english: word.english,
      partOfSpeech: word.partOfSpeech,
      gender: word.gender,
    });
  }, [word, generate]);

  useEffect(() => {
    cancelTranslations();
    if (open && word) {
      reset(NO_EXAMPLES);
      void fetchSuggestions();
    }
  }, [open, word, fetchSuggestions, cancelTranslations, reset]);

  const handleAcceptSelected = () => {
    const selected = toExampleSentences(suggestions.selectedItems);
    if (selected.length === 0) return;
    acceptedRows.append(selected);
    clearSuggestions();
  };

  const handleClose = useCallback(() => {
    resetSuggestions();
    reset(NO_EXAMPLES);
    cancelTranslations();
    onClose();
  }, [onClose, resetSuggestions, reset, cancelTranslations]);

  const save = useOptimisticModalSave({ onSave, onClose: handleClose });

  const validExamples = acceptedExamples.filter((ex) => ex.polish.trim() && ex.english.trim());

  const handleSave = () => {
    if (validExamples.length === 0) {
      handleClose();
      return;
    }
    save(
      validExamples.map((ex) => ({
        id: ex.id,
        polish: ex.polish.trim(),
        english: ex.english.trim(),
      }))
    );
  };

  if (!word) return null;

  const acceptedCount = acceptedRows.fields.length;

  return (
    <ModalDialog
      $maxWidth={540}
      open={open}
      onClose={handleClose}
      data-qa="suggest-vocabulary-examples-modal"
    >
      <ModalHeader>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Suggest Example Sentences</DialogTitle>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="close"
          data-qa="suggest-vocabulary-examples-close"
        >
          <CloseIcon />
        </IconButton>
      </ModalHeader>
      <ModalContent>
        <Box>
          <Typography variant="body2" color="text.secondary">
            For
          </Typography>
          <Typography variant="body1" fontWeight={500}>
            {word.polish}{' '}
            <Typography component="span" variant="body1" color="text.secondary">
              — {word.english}
            </Typography>
          </Typography>
        </Box>

        <Box>
          <SectionLabel variant="body2" sx={{ mb: 1 }}>
            Suggestions
          </SectionLabel>

          <SuggestionsBody
            suggestions={suggestions}
            hasAccepted={acceptedCount > 0}
            onFetch={fetchSuggestions}
            onAcceptSelected={handleAcceptSelected}
            onAddManually={acceptedRows.addEmptyRow}
          />
        </Box>

        {acceptedCount > 0 && (
          <Box>
            <SectionLabel variant="body2" sx={{ mb: 1 }}>
              Accepted ({acceptedCount})
            </SectionLabel>
            <Stack spacing={1.5}>
              <ExampleRowsEditor
                rows={acceptedRows}
                dataQaPrefix="suggest-vocabulary-examples-accepted"
              />
            </Stack>
          </Box>
        )}
      </ModalContent>
      <ModalActions>
        <Button
          onClick={handleClose}
          color="inherit"
          type="button"
          data-qa="suggest-vocabulary-examples-skip"
        >
          Skip
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={validExamples.length === 0}
          data-qa="suggest-vocabulary-examples-save"
        >
          Save
        </Button>
      </ModalActions>
    </ModalDialog>
  );
}

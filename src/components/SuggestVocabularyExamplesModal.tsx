import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import {
  DialogTitle,
  IconButton,
  TextField,
  Box,
  Button,
  Typography,
  CircularProgress,
  Skeleton,
  Stack,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';
import {
  ModalDialog,
  ModalHeader,
  ModalContent,
  ModalActions,
  ExamplePairBox,
  ExampleRowHeader,
} from './modalStyles';
import { toExampleSentences } from '../lib/generateExample';
import { translate } from '../lib/translate';
import { useGeneratedExamples } from '../hooks/useGeneratedExamples';
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

interface AcceptedExampleRowProps {
  example: ExampleSentence;
  index: number;
  isTranslating: boolean;
  polishRef?: Ref<HTMLInputElement>;
  onPolishChange: (id: string, value: string) => void;
  onEnglishChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}

function AcceptedExampleRow({
  example,
  index,
  isTranslating,
  polishRef,
  onPolishChange,
  onEnglishChange,
  onRemove,
}: AcceptedExampleRowProps) {
  const id = example.id!;
  return (
    <ExamplePairBox data-qa="suggest-vocabulary-examples-accepted-row">
      <ExampleRowHeader>
        <Typography variant="caption" color="text.disabled">
          Example {index + 1}
        </Typography>
        <IconButton
          size="small"
          onClick={() => onRemove(id)}
          aria-label="remove example"
          sx={{ color: 'text.disabled' }}
          data-qa="suggest-vocabulary-examples-remove-accepted"
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </ExampleRowHeader>
      <TextField
        value={example.polish}
        onChange={(e) => onPolishChange(id, e.target.value)}
        inputRef={polishRef}
        label="Polish"
        size="small"
        fullWidth
        slotProps={{
          htmlInput: {
            'data-qa': 'suggest-vocabulary-examples-accepted-polish',
          },
        }}
      />
      <TextField
        value={example.english}
        onChange={(e) => onEnglishChange(id, e.target.value)}
        label="English"
        size="small"
        fullWidth
        slotProps={{
          input: {
            endAdornment: isTranslating ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : null,
          },
          htmlInput: {
            'data-qa': 'suggest-vocabulary-examples-accepted-english',
          },
        }}
      />
    </ExamplePairBox>
  );
}

interface SuggestVocabularyExamplesModalProps {
  open: boolean;
  word: VocabularyWord | null;
  onClose: () => void;
  onSave: (examples: ExampleSentence[]) => Promise<void> | void;
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
  const [acceptedExamples, setAcceptedExamples] = useState<ExampleSentence[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const newRowPolishRef = useRef<HTMLInputElement>(null);
  const translationTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const userEditedEnglishIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timeouts = translationTimeouts.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

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
    if (open && word) {
      setAcceptedExamples([]);
      translationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      translationTimeouts.current.clear();
      userEditedEnglishIds.current.clear();
      setTranslatingIds(new Set());
      void fetchSuggestions();
    }
  }, [open, word, fetchSuggestions]);

  const handleAcceptSelected = () => {
    const selected = toExampleSentences(suggestions.selectedItems);
    if (selected.length === 0) return;
    setAcceptedExamples((prev) => [...prev, ...selected]);
    clearSuggestions();
  };

  const translatePolishForRow = useCallback(async (id: string, polishText: string) => {
    const trimmed = polishText.trim();
    if (!trimmed) return;

    setTranslatingIds((prev) => new Set(prev).add(id));
    try {
      const result = await translate(trimmed, 'EN');
      if (!userEditedEnglishIds.current.has(id)) {
        setAcceptedExamples((prev) =>
          prev.map((ex) => (ex.id === id ? { ...ex, english: result.translatedText } : ex))
        );
      }
    } catch {
      // Silently fail - user can manually enter translation
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleAcceptedPolishChange = useCallback(
    (id: string, value: string) => {
      userEditedEnglishIds.current.delete(id);
      setAcceptedExamples((prev) =>
        prev.map((ex) => (ex.id === id ? { ...ex, polish: value } : ex))
      );

      const existing = translationTimeouts.current.get(id);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        translatePolishForRow(id, value);
        translationTimeouts.current.delete(id);
      }, 500);

      translationTimeouts.current.set(id, timeout);
    },
    [translatePolishForRow]
  );

  const handleAcceptedEnglishChange = useCallback((id: string, value: string) => {
    userEditedEnglishIds.current.add(id);
    setAcceptedExamples((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, english: value } : ex))
    );
  }, []);

  const handleAddManually = useCallback(() => {
    const newId = crypto.randomUUID();
    setAcceptedExamples((prev) => [...prev, { id: newId, polish: '', english: '' }]);
    setTimeout(() => {
      newRowPolishRef.current?.focus();
    }, 0);
  }, []);

  const handleRemoveAccepted = useCallback((id: string) => {
    const timeout = translationTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      translationTimeouts.current.delete(id);
    }
    userEditedEnglishIds.current.delete(id);
    setAcceptedExamples((prev) => prev.filter((ex) => ex.id !== id));
  }, []);

  const handleClose = useCallback(() => {
    resetSuggestions();
    setAcceptedExamples([]);
    setIsSaving(false);
    setTranslatingIds(new Set());
    translationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    translationTimeouts.current.clear();
    userEditedEnglishIds.current.clear();
    onClose();
  }, [onClose, resetSuggestions]);

  const handleSave = useCallback(async () => {
    const valid = acceptedExamples.filter((ex) => ex.polish.trim() && ex.english.trim());
    if (valid.length === 0) {
      handleClose();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        valid.map((ex) => ({
          id: ex.id,
          polish: ex.polish.trim(),
          english: ex.english.trim(),
        }))
      );
      handleClose();
    } finally {
      setIsSaving(false);
    }
  }, [acceptedExamples, onSave, handleClose]);

  if (!word) return null;

  const acceptedCount = acceptedExamples.length;
  const hasAcceptedToSave = acceptedExamples.some((ex) => ex.polish.trim() && ex.english.trim());

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
            onAddManually={handleAddManually}
          />
        </Box>

        {acceptedCount > 0 && (
          <Box>
            <SectionLabel variant="body2" sx={{ mb: 1 }}>
              Accepted ({acceptedCount})
            </SectionLabel>
            <Stack spacing={1.5}>
              {acceptedExamples.map((ex, index) => (
                <AcceptedExampleRow
                  key={ex.id}
                  example={ex}
                  index={index}
                  isTranslating={translatingIds.has(ex.id!)}
                  polishRef={index === acceptedExamples.length - 1 ? newRowPolishRef : undefined}
                  onPolishChange={handleAcceptedPolishChange}
                  onEnglishChange={handleAcceptedEnglishChange}
                  onRemove={handleRemoveAccepted}
                />
              ))}
            </Stack>
          </Box>
        )}
      </ModalContent>
      <ModalActions>
        <Button
          onClick={handleClose}
          color="inherit"
          type="button"
          disabled={isSaving}
          data-qa="suggest-vocabulary-examples-skip"
        >
          Skip
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasAcceptedToSave || isSaving}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
          data-qa="suggest-vocabulary-examples-save"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </ModalActions>
    </ModalDialog>
  );
}

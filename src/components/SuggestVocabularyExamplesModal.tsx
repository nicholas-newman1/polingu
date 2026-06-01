import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Box,
  Button,
  Typography,
  CircularProgress,
  Checkbox,
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
import { alpha } from '../lib/theme';
import { generateExample, type GeneratedExample } from '../lib/generateExample';
import { translate } from '../lib/translate';
import type { ExampleSentence, VocabularyWord } from '../types/vocabulary';

const SUGGESTION_CAP = 3;

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 540,
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

const SectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

const SuggestionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.success.main, 0.08),
  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  cursor: 'pointer',
}));

const AcceptedRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.02),
  border: `1px solid ${theme.palette.divider}`,
}));

const RowHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

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
  const [suggestions, setSuggestions] = useState<GeneratedExample[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [acceptedExamples, setAcceptedExamples] = useState<ExampleSentence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const fetchSuggestions = useCallback(async () => {
    if (!word) return;

    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setSelectedIndexes(new Set());

    try {
      const result = await generateExample({
        polish: word.polish,
        english: word.english,
        partOfSpeech: word.partOfSpeech,
        gender: word.gender,
      });
      const capped = result.examples.slice(0, SUGGESTION_CAP);
      setSuggestions(capped);
      setSelectedIndexes(new Set(capped.map((_, i) => i)));
    } catch (err) {
      console.error('Failed to generate sentence suggestions:', err);
      setError('Failed to generate suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [word]);

  useEffect(() => {
    if (open && word) {
      setSuggestions([]);
      setSelectedIndexes(new Set());
      setAcceptedExamples([]);
      setError(null);
      translationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      translationTimeouts.current.clear();
      userEditedEnglishIds.current.clear();
      setTranslatingIds(new Set());
      void fetchSuggestions();
    }
  }, [open, word, fetchSuggestions]);

  const handleToggleSuggestion = useCallback((index: number) => {
    setSelectedIndexes((prev) => {
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
    const selected = suggestions
      .filter((_, i) => selectedIndexes.has(i))
      .map<ExampleSentence>(({ polish, english }) => ({
        id: crypto.randomUUID(),
        polish,
        english,
      }));
    if (selected.length === 0) return;
    setAcceptedExamples((prev) => [...prev, ...selected]);
    setSuggestions([]);
    setSelectedIndexes(new Set());
  }, [suggestions, selectedIndexes]);

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
    setSuggestions([]);
    setSelectedIndexes(new Set());
    setAcceptedExamples([]);
    setError(null);
    setIsLoading(false);
    setIsSaving(false);
    setTranslatingIds(new Set());
    translationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    translationTimeouts.current.clear();
    userEditedEnglishIds.current.clear();
    onClose();
  }, [onClose]);

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

  const selectedCount = selectedIndexes.size;
  const acceptedCount = acceptedExamples.length;
  const hasAcceptedToSave = acceptedExamples.some((ex) => ex.polish.trim() && ex.english.trim());

  return (
    <StyledDialog open={open} onClose={handleClose} data-qa="suggest-vocabulary-examples-modal">
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Suggest Example Sentences</DialogTitle>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="close"
          data-qa="suggest-vocabulary-examples-close"
        >
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
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

          {isLoading && (
            <Stack spacing={1} data-qa="suggest-vocabulary-examples-loading">
              {Array.from({ length: SUGGESTION_CAP }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={72} />
              ))}
            </Stack>
          )}

          {!isLoading && error && (
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
              data-qa="suggest-vocabulary-examples-error"
            >
              <Typography variant="body2" color="error">
                {error}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchSuggestions}
                  data-qa="suggest-vocabulary-examples-retry"
                >
                  Try again
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  startIcon={<AddIcon />}
                  onClick={handleAddManually}
                  data-qa="suggest-vocabulary-examples-add-manually"
                >
                  Add manually
                </Button>
              </Box>
            </Box>
          )}

          {!isLoading && !error && suggestions.length > 0 && (
            <Stack spacing={1}>
              {suggestions.map((example, index) => (
                <SuggestionRow
                  key={index}
                  sx={{ opacity: selectedIndexes.has(index) ? 1 : 0.5 }}
                  onClick={() => handleToggleSuggestion(index)}
                  data-qa="suggest-vocabulary-examples-suggestion"
                >
                  <Checkbox
                    checked={selectedIndexes.has(index)}
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
                        sx={{ color: 'primary.main', fontStyle: 'italic' }}
                      >
                        ({example.meaning})
                      </Typography>
                    )}
                  </Box>
                </SuggestionRow>
              ))}

              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAcceptSelected}
                  disabled={selectedCount === 0}
                  data-qa="suggest-vocabulary-examples-accept-selected"
                >
                  Accept Selected ({selectedCount})
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchSuggestions}
                  disabled={isLoading}
                  data-qa="suggest-vocabulary-examples-regenerate"
                >
                  Regenerate
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  startIcon={<AddIcon />}
                  onClick={handleAddManually}
                  data-qa="suggest-vocabulary-examples-add-manually"
                >
                  Add manually
                </Button>
              </Box>
            </Stack>
          )}

          {!isLoading && !error && suggestions.length === 0 && acceptedCount === 0 && (
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
              data-qa="suggest-vocabulary-examples-empty"
            >
              <Typography variant="body2" color="text.secondary">
                No suggestions to show.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={fetchSuggestions}
                  data-qa="suggest-vocabulary-examples-generate"
                >
                  Generate suggestions
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  startIcon={<AddIcon />}
                  onClick={handleAddManually}
                  data-qa="suggest-vocabulary-examples-add-manually"
                >
                  Add manually
                </Button>
              </Box>
            </Box>
          )}

          {!isLoading && !error && suggestions.length === 0 && acceptedCount > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchSuggestions}
                disabled={isLoading}
                data-qa="suggest-vocabulary-examples-regenerate"
              >
                Regenerate
              </Button>
              <Button
                size="small"
                variant="text"
                color="inherit"
                startIcon={<AddIcon />}
                onClick={handleAddManually}
                data-qa="suggest-vocabulary-examples-add-manually"
              >
                Add manually
              </Button>
            </Box>
          )}
        </Box>

        {acceptedCount > 0 && (
          <Box>
            <SectionLabel variant="body2" sx={{ mb: 1 }}>
              Accepted ({acceptedCount})
            </SectionLabel>
            <Stack spacing={1.5}>
              {acceptedExamples.map((ex, index) => (
                <AcceptedRow key={ex.id} data-qa="suggest-vocabulary-examples-accepted-row">
                  <RowHeader>
                    <Typography variant="caption" color="text.disabled">
                      Example {index + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveAccepted(ex.id!)}
                      aria-label="remove example"
                      sx={{ color: 'text.disabled' }}
                      data-qa="suggest-vocabulary-examples-remove-accepted"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </RowHeader>
                  <TextField
                    value={ex.polish}
                    onChange={(e) => handleAcceptedPolishChange(ex.id!, e.target.value)}
                    inputRef={index === acceptedExamples.length - 1 ? newRowPolishRef : undefined}
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
                    value={ex.english}
                    onChange={(e) => handleAcceptedEnglishChange(ex.id!, e.target.value)}
                    label="English"
                    size="small"
                    fullWidth
                    slotProps={{
                      input: {
                        endAdornment: translatingIds.has(ex.id!) ? (
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
                </AcceptedRow>
              ))}
            </Stack>
          </Box>
        )}
      </Content>
      <Actions>
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
      </Actions>
    </StyledDialog>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { styled } from '../../lib/styled';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import AbcIcon from '@mui/icons-material/Abc';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { translate, RateLimitMinuteError, RateLimitDailyError } from '../../lib/translate';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { useBackClose } from '../../hooks/useBackClose';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useAddToVocabulary } from '../../hooks/useAddToVocabulary';
import { useAddSentence } from '../../hooks/useAddSentence';
import { DirectionToggle } from '../DirectionToggle';
import type { TranslationDirection } from '../../types/common';

const MAX_TEXT_LENGTH = 500;

const StyledDialog = styled(Dialog)<{ $keyboardOpen?: boolean }>(({ theme, $keyboardOpen }) => ({
  '& .MuiDialog-container': {
    alignItems: $keyboardOpen ? 'flex-start' : 'center',
    paddingTop: $keyboardOpen ? theme.spacing(2) : 0,
  },
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 500,
    margin: theme.spacing(2),
    maxHeight: $keyboardOpen ? 'calc(100% - 16px)' : undefined,
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

const ResultBox = styled(Box)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  minHeight: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const ResultActions = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  display: 'flex',
  gap: theme.spacing(0.25),
}));

export function TranslatorModal() {
  const {
    showTranslator: open,
    closeTranslator: onClose,
    handleDailyLimitReached: onDailyLimitReached,
    handleTranslationSuccess: onTranslationSuccess,
  } = useTranslationContext();
  const { showSnackbar } = useSnackbar();
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();
  const [text, setText] = useState('');
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [result, setResult] = useState('');
  const [direction, setDirection] = useState<TranslationDirection>('en-to-pl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setText('');
    setResult('');
    setError(null);
    onClose();
  }, [onClose]);

  useBackClose(open, handleClose);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const initialHeight = window.innerHeight;

    const handleResize = () => {
      const heightDiff = initialHeight - viewport.height;
      setKeyboardOpen(heightDiff > 150);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, [open]);

  useEffect(() => {
    if (!text.trim()) {
      setResult('');
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const targetLang = direction === 'en-to-pl' ? 'PL' : 'EN';
        const translationResult = await translate(text, targetLang);
        setResult(translationResult.translatedText);
        onTranslationSuccess?.(translationResult);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;

        if (err instanceof RateLimitMinuteError) {
          setError('Too many requests. Please wait a moment.');
          return;
        }

        if (err instanceof RateLimitDailyError) {
          handleClose();
          onDailyLimitReached(err.resetTime);
          return;
        }

        console.error('Translation error:', err);
        setError('Translation failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [text, direction, handleClose, onDailyLimitReached, onTranslationSuccess]);

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      showSnackbar('Translation copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy translation', 'error');
    }
  };

  const getPrefill = () => {
    const polish = direction === 'en-to-pl' ? result : text;
    const english = direction === 'en-to-pl' ? text : result;
    return { polish: polish.trim(), english: english.trim() };
  };

  const handleOpenAddMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleCloseAddMenu = () => {
    setAddMenuAnchor(null);
  };

  const handleAddToVocabulary = () => {
    const { polish, english } = getPrefill();
    handleCloseAddMenu();
    handleClose();
    setTimeout(() => {
      addToVocabulary?.openAddToVocabulary(polish, english);
    }, 0);
  };

  const handleAddToSentences = () => {
    const { polish, english } = getPrefill();
    handleCloseAddMenu();
    handleClose();
    setTimeout(() => {
      addSentence?.openAddSentence({ polish, english });
    }, 0);
  };

  const toggleDirection = () => {
    setDirection((prev) => (prev === 'en-to-pl' ? 'pl-to-en' : 'en-to-pl'));
    if (result) setText(result);
    setResult('');
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <StyledDialog open={open} onClose={handleClose} $keyboardOpen={keyboardOpen}>
      <Header>
        <DialogTitle sx={{ p: 0, fontWeight: 500 }}>Translator</DialogTitle>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Header>
      <Content>
        <TextField
          multiline
          rows={3}
          placeholder={
            direction === 'en-to-pl' ? 'Enter English text...' : 'Wpisz tekst po polsku...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          autoFocus
          inputRef={inputRef}
          inputProps={{
            maxLength: MAX_TEXT_LENGTH,
            style: {
              WebkitUserSelect: 'text',
              userSelect: 'text',
            },
          }}
          helperText={`${text.length} / ${MAX_TEXT_LENGTH}`}
        />

        <Box sx={{ alignSelf: 'center' }}>
          <DirectionToggle direction={direction} onToggle={toggleDirection} />
        </Box>

        <ResultBox>
          {loading ? (
            <CircularProgress size={24} />
          ) : error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : result ? (
            <>
              <Typography variant="body1" sx={{ width: '100%', pr: 8 }}>
                {result}
              </Typography>
              <ResultActions>
                <IconButton size="small" onClick={handleCopy} aria-label="copy translation">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                {(addToVocabulary || addSentence) && (
                  <IconButton
                    size="small"
                    onClick={handleOpenAddMenu}
                    aria-label="save translation"
                  >
                    <BookmarkAddIcon fontSize="small" />
                  </IconButton>
                )}
              </ResultActions>
            </>
          ) : (
            <Typography variant="body2" color="text.disabled">
              Translation will appear here
            </Typography>
          )}
        </ResultBox>
      </Content>
      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={handleCloseAddMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {addToVocabulary && (
          <MenuItem onClick={handleAddToVocabulary}>
            <ListItemIcon>
              <AbcIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add to Vocabulary</ListItemText>
          </MenuItem>
        )}
        {addSentence && (
          <MenuItem onClick={handleAddToSentences}>
            <ListItemIcon>
              <TextSnippetIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add to Sentences</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </StyledDialog>
  );
}

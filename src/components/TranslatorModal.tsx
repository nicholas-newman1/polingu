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
} from '@mui/material';
import { styled } from '../lib/styled';
import CloseIcon from '@mui/icons-material/Close';
import {
  translate,
  RateLimitMinuteError,
  RateLimitDailyError,
} from '../lib/translate';
import { useTranslationContext } from '../hooks/useTranslationContext';
import { useBackClose } from '../hooks/useBackClose';
import { DirectionToggle, type TranslationDirection } from './DirectionToggle';

const MAX_TEXT_LENGTH = 500;

const StyledDialog = styled(Dialog)<{ $keyboardOpen?: boolean }>(
  ({ theme, $keyboardOpen }) => ({
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
  })
);

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
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  minHeight: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

export function TranslatorModal() {
  const {
    showTranslator: open,
    closeTranslator: onClose,
    handleDailyLimitReached: onDailyLimitReached,
    handleTranslationSuccess: onTranslationSuccess,
  } = useTranslationContext();
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [direction, setDirection] = useState<TranslationDirection>('en-to-pl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    setText('');
    setResult('');
    setError(null);
    onClose();
  }, [onClose]);

  useBackClose(open, handleClose);

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

  const toggleDirection = () => {
    setDirection((prev) => (prev === 'en-to-pl' ? 'pl-to-en' : 'en-to-pl'));
    if (result) setText(result);
    setResult('');
    setError(null);
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleClose}
      $keyboardOpen={keyboardOpen}
    >
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
            direction === 'en-to-pl'
              ? 'Enter English text...'
              : 'Wpisz tekst po polsku...'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          autoFocus
          inputProps={{ maxLength: MAX_TEXT_LENGTH }}
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
            <Typography variant="body1" sx={{ width: '100%' }}>
              {result}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              Translation will appear here
            </Typography>
          )}
        </ResultBox>
      </Content>
    </StyledDialog>
  );
}

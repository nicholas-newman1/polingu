import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Box,
  Typography,
  Button,
  CircularProgress,
  styled,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  translate,
  RateLimitMinuteError,
  RateLimitDailyError,
} from '../lib/translate';
import { useTranslationContext } from '../hooks/useTranslationContext';

const MAX_TEXT_LENGTH = 500;

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

const ResultBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  minHeight: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const DirectionButton = styled(Button)(({ theme }) => ({
  alignSelf: 'center',
  textTransform: 'none',
  fontWeight: 500,
  gap: theme.spacing(1),
}));

type Direction = 'EN_TO_PL' | 'PL_TO_EN';

export function TranslatorModal() {
  const {
    showTranslator: open,
    closeTranslator: onClose,
    handleDailyLimitReached: onDailyLimitReached,
    handleTranslationSuccess: onTranslationSuccess,
  } = useTranslationContext();
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [direction, setDirection] = useState<Direction>('EN_TO_PL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    setText('');
    setResult('');
    setError(null);
    onClose();
  }, [onClose]);

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
        const targetLang = direction === 'EN_TO_PL' ? 'PL' : 'EN';
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
    setDirection((prev) => (prev === 'EN_TO_PL' ? 'PL_TO_EN' : 'EN_TO_PL'));
    if (result) setText(result);
    setResult('');
    setError(null);
  };

  return (
    <StyledDialog open={open} onClose={handleClose}>
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
            direction === 'EN_TO_PL'
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

        <DirectionButton
          variant="outlined"
          size="small"
          onClick={toggleDirection}
        >
          {direction === 'EN_TO_PL' ? 'EN' : 'PL'}
          <SwapHorizIcon sx={{ fontSize: 18 }} />
          {direction === 'EN_TO_PL' ? 'PL' : 'EN'}
        </DirectionButton>

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

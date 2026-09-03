import { useEffect, useState, useRef } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  IconButton,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '../lib/styled';
import { TranslatableTextProvider } from '../contexts/TranslatableTextContext';
import { useTranslatableText } from '../hooks/useTranslatableText';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAddSentence } from '../hooks/useAddSentence';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAuthContext } from '../hooks/useAuthContext';
import { translate, RateLimitMinuteError, RateLimitDailyError } from '../lib/translate';
import { TooltipContent, WordTooltipPopper } from './shared';

const TextContainer = styled(Box)({
  display: 'inline',
  userSelect: 'none',
});

interface PhraseTooltipProps {
  sentenceContext?: string;
  getSentenceContext?: (selectedIndices: number[]) => string | undefined;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (phrase: string, translation: string) => void;
}

function cleanPhrase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?;:"""''()]/g, '').toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function cleanWord(word: string): string {
  return word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
}

const TooltipIconButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.text,
  '&:hover': {
    backgroundColor: 'transparent',
  },
}));

const SaveOptionButton = styled(IconButton)(({ theme }) => ({
  padding: '2px 6px',
  borderRadius: 4,
  color: theme.palette.tooltip.text,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  fontSize: '0.6rem',
  '&:hover': {
    backgroundColor: 'transparent',
    color: theme.palette.primary.main,
  },
}));

function PhraseTooltip({
  sentenceContext,
  getSentenceContext,
  translations,
  declensionCardId,
  sentenceId,
  onDailyLimitReached,
  onUpdateTranslation,
}: PhraseTooltipProps) {
  const context = useTranslatableText();
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();
  const { showSnackbar } = useSnackbar();
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);

  const selectedPhrase = context?.selectedPhrase;
  const phraseAnchorEl = context?.phraseAnchorEl;
  const closePhraseTooltip = context?.closePhraseTooltip;
  const getSelectedIndices = context?.getSelectedIndices;

  const getSentenceContextRef = useRef(getSentenceContext);
  useEffect(() => {
    getSentenceContextRef.current = getSentenceContext;
  });

  useEffect(() => {
    if (!selectedPhrase) setShowSaveMenu(false);
  }, [selectedPhrase]);

  const handleAddToVocabulary = () => {
    if (selectedPhrase && addToVocabulary) {
      addToVocabulary.openAddToVocabulary(selectedPhrase, translation || '');
      closePhraseTooltip?.();
    }
  };

  const handleAddSentence = () => {
    if (selectedPhrase && addSentence) {
      addSentence.openAddSentence({ polish: selectedPhrase, english: translation || '' });
      closePhraseTooltip?.();
    }
  };

  const handleCopy = async () => {
    if (!selectedPhrase) return;
    try {
      await navigator.clipboard.writeText(selectedPhrase);
      showSnackbar('Copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy', 'error');
    }
  };

  useEffect(() => {
    if (!selectedPhrase) {
      setTranslation(null);
      setError(null);
      return;
    }

    const cacheKey = cleanPhrase(selectedPhrase);
    const cachedTranslation = translations?.[cacheKey];
    if (cachedTranslation) {
      setTranslation(cachedTranslation);
      return;
    }

    const fetchTranslation = async () => {
      setLoading(true);
      setError(null);
      try {
        const dynamicContext = getSentenceContextRef.current?.(getSelectedIndices?.() ?? []);
        const effectiveContext = dynamicContext ?? sentenceContext;
        const result = await translate(
          selectedPhrase,
          'EN',
          effectiveContext,
          declensionCardId,
          sentenceId
        );
        setTranslation(result.translatedText);
        onUpdateTranslation?.(cacheKey, result.translatedText);
      } catch (err) {
        if (err instanceof RateLimitMinuteError) {
          setError('Too many requests');
          showSnackbar('Too many requests. Please wait a moment.', 'warning');
        } else if (err instanceof RateLimitDailyError) {
          closePhraseTooltip?.();
          onDailyLimitReached?.(err.resetTime);
        } else {
          setError('Translation failed');
          showSnackbar('Translation failed. Please try again.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTranslation();
  }, [
    selectedPhrase,
    sentenceContext,
    translations,
    declensionCardId,
    sentenceId,
    onDailyLimitReached,
    onUpdateTranslation,
    closePhraseTooltip,
    showSnackbar,
    getSelectedIndices,
  ]);

  useEffect(() => {
    if (!selectedPhrase) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (popperRef.current && !popperRef.current.contains(target)) {
        closePhraseTooltip?.();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedPhrase, closePhraseTooltip]);

  if (!selectedPhrase || !phraseAnchorEl) return null;

  return (
    <WordTooltipPopper
      open={true}
      anchorEl={phraseAnchorEl}
      popperRef={popperRef}
      modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
    >
      <TooltipContent>
        {loading ? (
          <CircularProgress size={16} sx={{ color: 'tooltip.text' }} />
        ) : (
          <>
            {error ? (
              <Typography variant="caption" sx={{ color: 'tooltip.error' }}>
                {error}
              </Typography>
            ) : (
              <Typography variant="body2" fontWeight={500}>
                {translation}
              </Typography>
            )}
            <TooltipIconButton size="small" onClick={handleCopy} aria-label="Copy to clipboard">
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </TooltipIconButton>
            {showSaveMenu ? (
              <>
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 0.5, borderColor: 'tooltip.text', opacity: 0.3 }}
                />
                <SaveOptionButton
                  size="small"
                  onClick={handleAddToVocabulary}
                  aria-label="Add to vocabulary"
                >
                  <BookmarkAddOutlinedIcon sx={{ fontSize: 14 }} />
                  <Box component="span" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                    Vocab
                  </Box>
                </SaveOptionButton>
                <SaveOptionButton
                  size="small"
                  onClick={handleAddSentence}
                  aria-label="Add as sentence"
                >
                  <FormatQuoteIcon sx={{ fontSize: 14 }} />
                  <Box component="span" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                    Sentence
                  </Box>
                </SaveOptionButton>
              </>
            ) : (
              (addToVocabulary || addSentence) && (
                <TooltipIconButton
                  size="small"
                  onClick={() => setShowSaveMenu(true)}
                  aria-label="Save"
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </TooltipIconButton>
              )
            )}
          </>
        )}
      </TooltipContent>
    </WordTooltipPopper>
  );
}

const EditButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.muted,
  '&:hover': {
    color: theme.palette.tooltip.text,
    backgroundColor: 'transparent',
  },
}));

const EditInput = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    color: theme.palette.tooltip.text,
    fontSize: '0.875rem',
    padding: 0,
  },
  '& .MuiInputBase-input': {
    padding: theme.spacing(0.5, 1),
    minWidth: 80,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.tooltip.muted,
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.tooltip.text,
  },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.tooltip.accent,
  },
}));

const ActionIconButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.text,
  '&:hover': {
    backgroundColor: 'transparent',
  },
}));

interface WordTooltipProps {
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

function WordTooltip({
  translations,
  declensionCardId,
  sentenceId,
  onDailyLimitReached,
  onUpdateTranslation,
}: WordTooltipProps) {
  const context = useTranslatableText();
  const addToVocabulary = useAddToVocabulary();
  const { showSnackbar } = useSnackbar();
  const { isAdmin } = useAuthContext();
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeWord = context?.activeWord;
  const closeWordTooltip = context?.closeWordTooltip;

  useEffect(() => {
    if (!activeWord) {
      setTranslation(null);
      setError(null);
      setIsEditing(false);
      return;
    }

    const cacheKey = cleanWord(activeWord.word);
    const cachedTranslation = translations?.[cacheKey];
    if (cachedTranslation) {
      setTranslation(cachedTranslation);
      return;
    }

    const fetchTranslation = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await translate(
          cacheKey,
          'EN',
          activeWord.sentenceContext,
          declensionCardId,
          sentenceId
        );
        setTranslation(result.translatedText);
      } catch (err) {
        if (err instanceof RateLimitMinuteError) {
          setError('Too many requests');
          showSnackbar('Too many requests. Please wait a moment.', 'warning');
        } else if (err instanceof RateLimitDailyError) {
          closeWordTooltip?.();
          onDailyLimitReached?.(err.resetTime);
        } else {
          setError('Translation failed');
          showSnackbar('Translation failed. Please try again.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTranslation();
  }, [
    activeWord,
    translations,
    declensionCardId,
    sentenceId,
    onDailyLimitReached,
    closeWordTooltip,
    showSnackbar,
  ]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!activeWord) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (popperRef.current?.contains(target)) return;
      if (activeWord.anchorEl.contains(target)) return;
      if (target instanceof Element && target.closest('[data-word-index]')) return;
      closeWordTooltip?.();
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeWord, closeWordTooltip]);

  const handleStartEdit = () => {
    setEditValue(translation || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleSaveEdit = async () => {
    if (!activeWord || !editValue.trim() || editValue === translation) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      const cacheKey = cleanWord(activeWord.word);
      await onUpdateTranslation?.(cacheKey, editValue.trim());
      setTranslation(editValue.trim());
      setIsEditing(false);
    } catch {
      setError('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleAddToVocabulary = () => {
    if (activeWord && addToVocabulary) {
      addToVocabulary.openAddToVocabulary(activeWord.word, translation || '');
      closeWordTooltip?.();
    }
  };

  const handleCopy = async () => {
    if (!activeWord) return;
    try {
      await navigator.clipboard.writeText(activeWord.word);
      showSnackbar('Copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy', 'error');
    }
  };

  if (!activeWord) return null;

  return (
    <WordTooltipPopper
      open={true}
      anchorEl={activeWord.anchorEl}
      popperRef={popperRef}
      modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
    >
      <TooltipContent>
        {loading || isSaving ? (
          <CircularProgress size={16} sx={{ color: 'tooltip.text' }} />
        ) : isEditing ? (
          <EditInput
            size="small"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <ActionIconButton size="small" onClick={handleSaveEdit}>
                    <CheckIcon sx={{ fontSize: 14 }} />
                  </ActionIconButton>
                  <ActionIconButton size="small" onClick={handleCancelEdit}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </ActionIconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : (
          <>
            {error ? (
              <Typography variant="caption" sx={{ color: 'tooltip.error' }}>
                {error}
              </Typography>
            ) : (
              <Typography variant="body2" fontWeight={500}>
                {translation}
              </Typography>
            )}
            {isAdmin && translation && (
              <EditButton size="small" onClick={handleStartEdit}>
                <EditIcon sx={{ fontSize: 14 }} />
              </EditButton>
            )}
            <ActionIconButton size="small" onClick={handleCopy} aria-label="Copy to clipboard">
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </ActionIconButton>
            {addToVocabulary && (
              <ActionIconButton
                size="small"
                onClick={handleAddToVocabulary}
                aria-label="Add to vocabulary"
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </ActionIconButton>
            )}
          </>
        )}
      </TooltipContent>
    </WordTooltipPopper>
  );
}

interface TranslatableTextInnerProps {
  children: React.ReactNode;
}

function TranslatableTextInner({ children }: TranslatableTextInnerProps) {
  return <TextContainer>{children}</TextContainer>;
}

export interface TranslatableTextProps {
  children: React.ReactNode;
  sentenceContext?: string;
  getSentenceContext?: (selectedIndices: number[]) => string | undefined;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (phrase: string, translation: string) => void;
  onWordTap?: () => void;
}

export function TranslatableText({
  children,
  sentenceContext,
  getSentenceContext,
  translations,
  declensionCardId,
  sentenceId,
  onDailyLimitReached,
  onUpdateTranslation,
  onWordTap,
}: TranslatableTextProps) {
  return (
    <TranslatableTextProvider onWordTap={onWordTap}>
      <TranslatableTextInner>{children}</TranslatableTextInner>
      <WordTooltip
        translations={translations}
        declensionCardId={declensionCardId}
        sentenceId={sentenceId}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={onUpdateTranslation}
      />
      <PhraseTooltip
        sentenceContext={sentenceContext}
        getSentenceContext={getSentenceContext}
        translations={translations}
        declensionCardId={declensionCardId}
        sentenceId={sentenceId}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={onUpdateTranslation}
      />
    </TranslatableTextProvider>
  );
}

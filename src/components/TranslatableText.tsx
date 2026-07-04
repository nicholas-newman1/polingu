import { useEffect, useState, useRef } from 'react';
import { CircularProgress, Typography, Box, IconButton, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { styled } from '../lib/styled';
import { TranslatableTextProvider } from '../contexts/TranslatableTextContext';
import { useTranslatableText } from '../hooks/useTranslatableText';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAddSentence } from '../hooks/useAddSentence';
import { useSnackbar } from '../hooks/useSnackbar';
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
}: TranslatableTextProps) {
  return (
    <TranslatableTextProvider>
      <TranslatableTextInner>{children}</TranslatableTextInner>
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

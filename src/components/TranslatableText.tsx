import { useEffect, useState, useRef } from 'react';
import { CircularProgress, Typography, Box } from '@mui/material';
import { styled } from '../lib/styled';
import { TranslatableTextProvider } from '../contexts/TranslatableTextContext';
import { useTranslatableText } from '../hooks/useTranslatableText';
import { translate, RateLimitMinuteError, RateLimitDailyError } from '../lib/translate';
import { TooltipContent, WordTooltipPopper } from './shared';

const TextContainer = styled(Box)({
  display: 'inline',
  userSelect: 'none',
});

interface PhraseTooltipProps {
  sentenceContext?: string;
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

function PhraseTooltip({
  sentenceContext,
  translations,
  declensionCardId,
  sentenceId,
  onDailyLimitReached,
  onUpdateTranslation,
}: PhraseTooltipProps) {
  const context = useTranslatableText();
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popperRef = useRef<HTMLDivElement>(null);

  const selectedPhrase = context?.selectedPhrase;
  const phraseAnchorEl = context?.phraseAnchorEl;
  const closePhraseTooltip = context?.closePhraseTooltip;

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
        const result = await translate(
          selectedPhrase,
          'EN',
          sentenceContext,
          declensionCardId,
          sentenceId
        );
        setTranslation(result.translatedText);
        onUpdateTranslation?.(cacheKey, result.translatedText);
      } catch (err) {
        if (err instanceof RateLimitMinuteError) {
          setError('Too many requests');
        } else if (err instanceof RateLimitDailyError) {
          closePhraseTooltip?.();
          onDailyLimitReached?.(err.resetTime);
        } else {
          setError('Translation failed');
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
  ]);

  useEffect(() => {
    if (!selectedPhrase) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popperRef.current && !popperRef.current.contains(target)) {
        closePhraseTooltip?.();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
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
        ) : error ? (
          <Typography variant="caption" sx={{ color: 'tooltip.error' }}>
            {error}
          </Typography>
        ) : (
          <Typography variant="body2" fontWeight={500}>
            {translation}
          </Typography>
        )}
      </TooltipContent>
    </WordTooltipPopper>
  );
}

interface TranslatableTextInnerProps {
  children: React.ReactNode;
}

function TranslatableTextInner({ children }: TranslatableTextInnerProps) {
  const context = useTranslatableText();

  useEffect(() => {
    if (!context?.isDragging) return;

    const handleMouseUp = () => {
      context.endDrag();
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.target === document.documentElement) {
        context.endDrag();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [context]);

  return <TextContainer>{children}</TextContainer>;
}

export interface TranslatableTextProps {
  children: React.ReactNode;
  sentenceContext?: string;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (phrase: string, translation: string) => void;
}

export function TranslatableText({
  children,
  sentenceContext,
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
        translations={translations}
        declensionCardId={declensionCardId}
        sentenceId={sentenceId}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={onUpdateTranslation}
      />
    </TranslatableTextProvider>
  );
}

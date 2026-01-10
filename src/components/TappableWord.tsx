import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Popper,
  Paper,
  Typography,
  styled,
} from '@mui/material';
import {
  translate,
  RateLimitMinuteError,
  RateLimitDailyError,
} from '../lib/translate';
import { getCachedTranslation, getCacheKey } from '../lib/translationCache';

const TappableWordSpan = styled('span')(({ theme }) => ({
  cursor: 'pointer',
  borderRadius: 2,
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const HighlightedWordSpan = styled('span')(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 2,
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const PopoverContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  minWidth: 60,
  textAlign: 'center',
  color: '#fff',
}));

const TooltipPaper = styled(Paper)({
  position: 'relative',
  backgroundColor: '#1a1a1a',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #1a1a1a',
  },
});

export interface TappableWordProps {
  word: string;
  sentenceContext?: string;
  isHighlighted?: boolean;
  translationCache: React.MutableRefObject<Map<string, string>>;
  onDailyLimitReached?: (resetTime: string) => void;
}

export function TappableWord({
  word,
  sentenceContext,
  isHighlighted,
  translationCache,
  onDailyLimitReached,
}: TappableWordProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLSpanElement | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popperRef = useRef<HTMLDivElement>(null);

  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popperRef.current &&
        !popperRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        setAnchorEl(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, anchorEl]);

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLSpanElement>) => {
      const target = event.currentTarget;

      if (anchorEl) {
        setAnchorEl(null);
        return;
      }

      setAnchorEl(target);
      setError(null);

      const cleanWord = word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
      if (!cleanWord) {
        setAnchorEl(null);
        return;
      }

      const cacheKey = getCacheKey(cleanWord, sentenceContext);

      const memoryCached = translationCache.current.get(cacheKey);
      if (memoryCached) {
        setTranslation(memoryCached);
        return;
      }

      setLoading(true);
      setTranslation(null);

      try {
        const firestoreCached = await getCachedTranslation(
          cleanWord,
          sentenceContext
        );
        if (firestoreCached) {
          translationCache.current.set(cacheKey, firestoreCached);
          setTranslation(firestoreCached);
          return;
        }

        const result = await translate(cleanWord, 'EN', sentenceContext);
        translationCache.current.set(cacheKey, result.translatedText);
        setTranslation(result.translatedText);
      } catch (err) {
        if (err instanceof RateLimitMinuteError) {
          setError('Too many requests');
        } else if (err instanceof RateLimitDailyError) {
          setAnchorEl(null);
          onDailyLimitReached?.(err.resetTime);
        } else {
          setError('Translation failed');
        }
      } finally {
        setLoading(false);
      }
    },
    [anchorEl, word, sentenceContext, translationCache, onDailyLimitReached]
  );

  const WordComponent = isHighlighted ? HighlightedWordSpan : TappableWordSpan;

  return (
    <>
      <WordComponent onClick={handleClick}>{word}</WordComponent>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="top"
        modifiers={[
          {
            name: 'offset',
            options: { offset: [0, 4] },
          },
        ]}
      >
        <TooltipPaper ref={popperRef} elevation={8}>
          <PopoverContent>
            {loading ? (
              <CircularProgress size={16} sx={{ color: '#fff' }} />
            ) : error ? (
              <Typography variant="caption" sx={{ color: '#f87171' }}>
                {error}
              </Typography>
            ) : (
              <Typography variant="body2" fontWeight={500}>
                {translation}
              </Typography>
            )}
          </PopoverContent>
        </TooltipPaper>
      </Popper>
    </>
  );
}

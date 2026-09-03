import { useState, useCallback, useEffect, useSyncExternalStore, memo } from 'react';
import { CircularProgress, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { styled } from '../lib/styled';
import { translate, RateLimitMinuteError, RateLimitDailyError } from '../lib/translate';
import {
  useTooltipInteraction,
  TappableSpan,
  HighlightedSpan,
  TooltipContent,
  WordTooltipPopper,
} from './shared';
import { useTranslatableTextActions } from '../hooks/useTranslatableTextActions';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useSnackbar } from '../hooks/useSnackbar';

const AddToVocabButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.text,
  '&:hover': {
    backgroundColor: 'transparent',
  },
}));

const LONG_PRESS_MS = 400;
const TOUCH_MOVE_CANCEL_SQ = 100;

const SelectableSpan = styled(TappableSpan, {
  shouldForwardProp: (prop) => prop !== '$isSelected',
})<{ $isSelected?: boolean }>(({ theme, $isSelected }) => ({
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  ...($isSelected && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  }),
}));

const SelectableHighlightedSpan = styled(HighlightedSpan, {
  shouldForwardProp: (prop) => prop !== '$isSelected',
})<{ $isSelected?: boolean }>(({ theme, $isSelected }) => ({
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  ...($isSelected && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  }),
}));

const noopSubscribe = () => () => {};
const returnFalse = () => false;
const defaultInteractionSnapshot = '0:0';

export interface TranslatableWordProps {
  word: string;
  wordIndex?: number;
  sentenceContext?: string;
  isHighlighted?: boolean;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  disableHoverTranslate?: boolean;
}

function TranslatableWordComponent({
  word,
  wordIndex,
  sentenceContext,
  isHighlighted,
  translations,
  declensionCardId,
  sentenceId,
  onDailyLimitReached,
  disableHoverTranslate = false,
}: TranslatableWordProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = useTranslatableTextActions();
  const addToVocabulary = useAddToVocabulary();
  const { showSnackbar } = useSnackbar();
  const isDragEnabled = actions !== null && wordIndex !== undefined;
  const usesSharedClickTooltip = isDragEnabled;

  const subscribeSelection = actions?.subscribeSelection ?? noopSubscribe;
  const getSelectedSnapshot = useCallback(
    () => (isDragEnabled ? actions!.isIndexSelected(wordIndex) : false),
    [isDragEnabled, actions, wordIndex]
  );
  const isSelected = useSyncExternalStore(subscribeSelection, getSelectedSnapshot, returnFalse);

  const subscribeInteraction = actions?.subscribeInteractionState ?? noopSubscribe;
  const getInteractionSnapshot = useCallback(() => {
    if (!isDragEnabled) return defaultInteractionSnapshot;
    const { isDragging, hasPhrase } = actions!.getInteractionState();
    return `${isDragging ? 1 : 0}:${hasPhrase ? 1 : 0}`;
  }, [isDragEnabled, actions]);
  const interactionSnapshot = useSyncExternalStore(
    subscribeInteraction,
    getInteractionSnapshot,
    () => defaultInteractionSnapshot
  );
  const isDragging = isDragEnabled && interactionSnapshot.startsWith('1:');
  const hasPhrase = isDragEnabled && interactionSnapshot.endsWith(':1');

  const registerWord = actions?.registerWord;
  useEffect(() => {
    if (registerWord && wordIndex !== undefined) {
      registerWord(wordIndex, word);
    }
  }, [registerWord, wordIndex, word]);

  const {
    anchorEl,
    popperRef,
    open: hoverOpen,
    isClicked,
    setIsClicked,
    handleMouseEnter: baseHandleMouseEnter,
    handleMouseLeave,
    close,
  } = useTooltipInteraction();

  useEffect(() => {
    if (isDragging) {
      close();
    }
  }, [isDragging, close]);

  const cleanWord = word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();

  const fetchTranslation = useCallback(async () => {
    if (!cleanWord) return;

    const cachedTranslation = translations?.[cleanWord];
    if (cachedTranslation) {
      setTranslation(cachedTranslation);
      return;
    }

    if (translation || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await translate(
        cleanWord,
        'EN',
        sentenceContext,
        declensionCardId,
        sentenceId
      );
      setTranslation(result.translatedText);
    } catch (err) {
      if (err instanceof RateLimitMinuteError) {
        setError('Too many requests');
        showSnackbar('Too many requests. Please wait a moment.', 'warning');
      } else if (err instanceof RateLimitDailyError) {
        setIsClicked(false);
        onDailyLimitReached?.(err.resetTime);
      } else {
        setError('Translation failed');
        showSnackbar('Translation failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [
    cleanWord,
    sentenceContext,
    translations,
    declensionCardId,
    sentenceId,
    onDailyLimitReached,
    translation,
    loading,
    setIsClicked,
    showSnackbar,
  ]);

  const handleAddToVocabulary = () => {
    if (addToVocabulary) {
      addToVocabulary.openAddToVocabulary(word, translation || '');
      close();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(word);
      showSnackbar('Copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy', 'error');
    }
  };

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (!isDragEnabled || event.button !== 0) return;
      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const element = event.currentTarget;
      const THRESHOLD_SQ = 16;
      let dragStarted = false;

      const removeAll = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      const onMove = (e: MouseEvent) => {
        if (dragStarted) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy < THRESHOLD_SQ) return;
        dragStarted = true;
        document.removeEventListener('mousemove', onMove);
        actions!.startDrag(wordIndex, element);
      };

      const onUp = () => {
        removeAll();
        if (dragStarted) {
          actions!.endDrag();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isDragEnabled, actions, wordIndex]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLSpanElement>) => {
      if (!isDragEnabled) return;
      const touch = event.touches[0];
      if (!touch) return;

      const startX = touch.clientX;
      const startY = touch.clientY;
      const element = event.currentTarget;
      let dragStarted = false;
      let holdTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        holdTimer = null;
        dragStarted = true;
        actions!.startDrag(wordIndex, element);
      }, LONG_PRESS_MS);

      const removeAll = () => {
        if (holdTimer !== null) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
      };

      const onMove = (e: TouchEvent) => {
        if (dragStarted) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (dx * dx + dy * dy < TOUCH_MOVE_CANCEL_SQ) return;
        removeAll();
      };

      const onEnd = () => {
        removeAll();
        if (dragStarted) {
          actions!.endDrag();
        }
      };

      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    },
    [isDragEnabled, actions, wordIndex]
  );

  const handleMouseEnterWord = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (isDragEnabled) {
        actions!.updateDrag(wordIndex);
      }
      if (!isDragging && !hasPhrase && !disableHoverTranslate) {
        baseHandleMouseEnter(event);
        fetchTranslation();
      }
    },
    [
      isDragEnabled,
      actions,
      wordIndex,
      isDragging,
      hasPhrase,
      disableHoverTranslate,
      baseHandleMouseEnter,
      fetchTranslation,
    ]
  );

  const handleMouseLeaveWord = useCallback(() => {
    if (!isDragging && !hasPhrase) {
      handleMouseLeave();
    }
  }, [isDragging, hasPhrase, handleMouseLeave]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (hasPhrase) {
        actions?.closePhraseTooltip();
        return;
      }
      if (isDragging) return;

      if (usesSharedClickTooltip) {
        actions!.handleWordClick({
          index: wordIndex,
          word,
          anchorEl: event.currentTarget,
          sentenceContext,
          declensionCardId,
          sentenceId,
        });
        return;
      }

      if (isClicked) {
        setIsClicked(false);
      } else {
        setIsClicked(true);
        fetchTranslation();
      }
      if (event.currentTarget) {
        baseHandleMouseEnter(event);
      }
    },
    [
      hasPhrase,
      isDragging,
      usesSharedClickTooltip,
      actions,
      wordIndex,
      word,
      sentenceContext,
      declensionCardId,
      sentenceId,
      isClicked,
      setIsClicked,
      fetchTranslation,
      baseHandleMouseEnter,
    ]
  );

  const showLocalTooltip =
    (usesSharedClickTooltip ? hoverOpen && !disableHoverTranslate : hoverOpen) &&
    !isDragging &&
    !hasPhrase;
  const WordComponent = isHighlighted ? SelectableHighlightedSpan : SelectableSpan;

  return (
    <>
      <WordComponent
        $isSelected={isSelected}
        data-word-index={wordIndex}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnterWord}
        onMouseLeave={handleMouseLeaveWord}
        onTouchStart={handleTouchStart}
        onContextMenu={(event) => event.preventDefault()}
      >
        {word}
      </WordComponent>
      {showLocalTooltip && (
        <WordTooltipPopper
          open={showLocalTooltip}
          anchorEl={anchorEl}
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
                <AddToVocabButton size="small" onClick={handleCopy} aria-label="Copy to clipboard">
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </AddToVocabButton>
                {addToVocabulary && (
                  <AddToVocabButton
                    size="small"
                    onClick={handleAddToVocabulary}
                    aria-label="Add to vocabulary"
                  >
                    <AddIcon sx={{ fontSize: 14 }} />
                  </AddToVocabButton>
                )}
              </>
            )}
          </TooltipContent>
        </WordTooltipPopper>
      )}
    </>
  );
}

export const TranslatableWord = memo(TranslatableWordComponent);

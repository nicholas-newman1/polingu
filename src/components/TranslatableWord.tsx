import { useState, useCallback, useEffect, useSyncExternalStore, memo } from 'react';
import { CircularProgress, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { styled } from '../lib/styled';
import {
  translate,
  handleTooltipTranslationError,
  translationCacheKey,
  wordToTranslate,
  type TranslationResult,
} from '../lib/translate';
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

interface HoverLookup {
  /** The text looked up. Words are keyed by position, so a mounted word's text can change. */
  text: string;
  translation: string | null;
  error: string | null;
  pending: Promise<TranslationResult> | null;
}

interface TranslatableWordProps {
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
  const textToTranslate = wordToTranslate(word);
  const cacheKey = translationCacheKey(word);
  const [lookup, setLookup] = useState<HoverLookup | null>(null);
  const currentLookup = lookup?.text === textToTranslate ? lookup : null;
  const translation = currentLookup?.translation ?? null;
  const error = currentLookup?.error ?? null;
  const loading = !!currentLookup?.pending;

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

  const fetchTranslation = useCallback(async () => {
    if (!textToTranslate) return;

    const cachedTranslation = translations?.[cacheKey];
    if (cachedTranslation) {
      setLookup({
        text: textToTranslate,
        translation: cachedTranslation,
        error: null,
        pending: null,
      });
      return;
    }

    if (translation || loading) return;

    const pending = translate(textToTranslate, 'EN', {
      context: sentenceContext,
      declensionCardId,
      sentenceId,
    });
    setLookup({ text: textToTranslate, translation: null, error: null, pending });
    // Skipped once the word has changed and been looked up again.
    const update = (changes: Partial<HoverLookup>) =>
      setLookup((prev) => (prev?.pending === pending ? { ...prev, ...changes } : prev));

    try {
      const result = await pending;
      update({ translation: result.translatedText });
    } catch (err) {
      handleTooltipTranslationError(err, {
        setError: (message) => update({ error: message }),
        showSnackbar,
        onDailyLimit: (resetTime) => {
          setIsClicked(false);
          onDailyLimitReached?.(resetTime);
        },
      });
    } finally {
      update({ pending: null });
    }
  }, [
    textToTranslate,
    cacheKey,
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
      // The word's tap tooltip is open: a hover tooltip would stack on top of it.
      if (isDragEnabled && actions!.isWordActive(wordIndex)) return;
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
        const opened = actions!.handleWordClick({
          index: wordIndex,
          word,
          anchorEl: event.currentTarget,
          sentenceContext,
          declensionCardId,
          sentenceId,
          translation: translation ?? undefined,
          pendingTranslation: currentLookup?.pending ?? undefined,
        });
        // The tap tooltip takes over from the hover tooltip and its lookup.
        if (opened) close();
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
      translation,
      currentLookup,
      close,
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
        <WordTooltipPopper open={showLocalTooltip} anchorEl={anchorEl} popperRef={popperRef}>
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

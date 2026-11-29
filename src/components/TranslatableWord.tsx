import { useCallback, useEffect, useSyncExternalStore, memo } from 'react';
import { styled } from '../lib/styled';
import { translate, translationCacheKey, wordToTranslate } from '../lib/translate';
import {
  useTooltipInteraction,
  useTooltipTranslation,
  TooltipContent,
  TranslationTooltipBody,
  WordTooltipPopper,
} from './shared';
import { useTranslatableTextActions } from '../contexts/TranslatableTextContext';
import { useAddToVocabulary } from '../contexts/AddToVocabularyContext';

const LONG_PRESS_MS = 400;
const TOUCH_MOVE_CANCEL_SQ = 100;

const WordSpan = styled('span', {
  shouldForwardProp: (prop) => prop !== '$isSelected' && prop !== '$isHighlighted',
})<{ $isSelected: boolean; $isHighlighted?: boolean }>(
  ({ theme, $isSelected, $isHighlighted }) => ({
    ...($isHighlighted
      ? { color: theme.palette.primary.main, fontWeight: 600 }
      : { padding: '0 2px' }),
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'background-color 0.15s',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
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
  })
);

interface TranslatableWordProps {
  word: string;
  wordIndex: number;
  sentenceContext?: string;
  isHighlighted?: boolean;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
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
  disableHoverTranslate = false,
}: TranslatableWordProps) {
  const textToTranslate = wordToTranslate(word);
  const cacheKey = translationCacheKey(word);
  const actions = useTranslatableTextActions();
  const addToVocabulary = useAddToVocabulary();

  const getSelectedSnapshot = useCallback(
    () => actions.isIndexSelected(wordIndex),
    [actions, wordIndex]
  );
  const isSelected = useSyncExternalStore(actions.subscribeSelection, getSelectedSnapshot);

  const getInteractionSnapshot = useCallback(() => {
    const { isDragging, hasPhrase } = actions.getInteractionState();
    return `${isDragging ? 1 : 0}:${hasPhrase ? 1 : 0}`;
  }, [actions]);
  const interactionSnapshot = useSyncExternalStore(
    actions.subscribeInteractionState,
    getInteractionSnapshot
  );
  const isDragging = interactionSnapshot.startsWith('1:');
  const hasPhrase = interactionSnapshot.endsWith(':1');

  const { registerWord } = actions;
  useEffect(() => {
    registerWord(wordIndex, word);
  }, [registerWord, wordIndex, word]);

  const {
    anchorEl,
    popperRef,
    open: hoverOpen,
    handleMouseEnter: baseHandleMouseEnter,
    handleMouseLeave,
    close,
  } = useTooltipInteraction();

  // Keyed by the text, as words are keyed by position, so a mounted word's text can change.
  const { translation, error, loading, pending, show, lookUp } = useTooltipTranslation(
    textToTranslate,
    close
  );

  useEffect(() => {
    if (isDragging) {
      close();
    }
  }, [isDragging, close]);

  const fetchTranslation = useCallback(() => {
    if (!textToTranslate) return;

    const cachedTranslation = translations?.[cacheKey];
    if (cachedTranslation) {
      show(cachedTranslation);
      return;
    }

    if (translation || loading) return;

    lookUp(
      translate(textToTranslate, 'EN', {
        context: sentenceContext,
        declensionCardId,
        sentenceId,
      })
    );
  }, [
    textToTranslate,
    cacheKey,
    sentenceContext,
    translations,
    declensionCardId,
    sentenceId,
    translation,
    loading,
    show,
    lookUp,
  ]);

  const handleAddToVocabulary = () => {
    if (addToVocabulary) {
      addToVocabulary.openAddToVocabulary(word, translation || '');
      close();
    }
  };

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (event.button !== 0) return;
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
        actions.startDrag(wordIndex, element);
      };

      const onUp = () => {
        removeAll();
        if (dragStarted) {
          actions.endDrag();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [actions, wordIndex]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLSpanElement>) => {
      const touch = event.touches[0];
      if (!touch) return;

      const startX = touch.clientX;
      const startY = touch.clientY;
      const element = event.currentTarget;
      let dragStarted = false;
      let holdTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        holdTimer = null;
        dragStarted = true;
        actions.startDrag(wordIndex, element);
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
          actions.endDrag();
        }
      };

      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    },
    [actions, wordIndex]
  );

  const handleMouseEnterWord = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      actions.updateDrag(wordIndex);
      // The word's tap tooltip is open: a hover tooltip would stack on top of it.
      if (actions.isWordActive(wordIndex)) return;
      if (!isDragging && !hasPhrase && !disableHoverTranslate) {
        baseHandleMouseEnter(event);
        fetchTranslation();
      }
    },
    [
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
        actions.closePhraseTooltip();
        return;
      }
      if (isDragging) return;

      const opened = actions.handleWordClick({
        index: wordIndex,
        word,
        anchorEl: event.currentTarget,
        sentenceContext,
        declensionCardId,
        sentenceId,
        translation: translation ?? undefined,
        pendingTranslation: pending ?? undefined,
      });
      // The tap tooltip takes over from the hover tooltip and its lookup.
      if (opened) close();
    },
    [
      hasPhrase,
      isDragging,
      actions,
      wordIndex,
      word,
      sentenceContext,
      declensionCardId,
      sentenceId,
      translation,
      pending,
      close,
    ]
  );

  const showHoverTooltip = hoverOpen && !isDragging && !hasPhrase;

  return (
    <>
      <WordSpan
        $isSelected={isSelected}
        $isHighlighted={isHighlighted}
        data-word-index={wordIndex}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnterWord}
        onMouseLeave={handleMouseLeaveWord}
        onTouchStart={handleTouchStart}
        onContextMenu={(event) => event.preventDefault()}
      >
        {word}
      </WordSpan>
      {showHoverTooltip && (
        <WordTooltipPopper open={showHoverTooltip} anchorEl={anchorEl} popperRef={popperRef}>
          <TooltipContent>
            <TranslationTooltipBody
              text={word}
              translation={translation}
              error={error}
              loading={loading}
              iconSize={14}
              onAddToVocabulary={addToVocabulary ? handleAddToVocabulary : undefined}
            />
          </TooltipContent>
        </WordTooltipPopper>
      )}
    </>
  );
}

export const TranslatableWord = memo(TranslatableWordComponent);

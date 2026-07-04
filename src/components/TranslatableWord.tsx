import { useState, useCallback, useEffect, useRef, useSyncExternalStore, memo } from 'react';
import { CircularProgress, Typography, IconButton, TextField, InputAdornment } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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
import { useTranslatableText } from '../hooks/useTranslatableText';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useSnackbar } from '../hooks/useSnackbar';

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

const AddToVocabButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.text,
  '&:hover': {
    backgroundColor: 'transparent',
  },
}));

const SelectableSpan = styled(TappableSpan, {
  shouldForwardProp: (prop) => prop !== '$isSelected',
})<{ $isSelected?: boolean }>(({ theme, $isSelected }) => ({
  touchAction: 'none',
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
  touchAction: 'none',
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

export interface TranslatableWordProps {
  word: string;
  wordIndex?: number;
  sentenceContext?: string;
  isHighlighted?: boolean;
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
  isAdmin?: boolean;
  disableHoverTranslate?: boolean;
  onTranslateRequest?: () => void;
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
  onUpdateTranslation,
  isAdmin = false,
  disableHoverTranslate = false,
  onTranslateRequest,
}: TranslatableWordProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  console.log('render');

  const dragContext = useTranslatableText();
  const addToVocabulary = useAddToVocabulary();
  const { showSnackbar } = useSnackbar();
  const isDragEnabled = dragContext !== null && wordIndex !== undefined;

  const subscribeSelection = dragContext?.subscribeSelection ?? noopSubscribe;
  const getSelectedSnapshot = useCallback(
    () => (isDragEnabled ? dragContext.isIndexSelected(wordIndex) : false),
    [isDragEnabled, dragContext, wordIndex]
  );
  const isSelected = useSyncExternalStore(subscribeSelection, getSelectedSnapshot, returnFalse);

  const isDragging = isDragEnabled && dragContext.isDragging;
  const hasPhrase = isDragEnabled && dragContext.selectedPhrase !== null;

  const registerWord = dragContext?.registerWord;
  useEffect(() => {
    if (registerWord && wordIndex !== undefined) {
      registerWord(wordIndex, word);
    }
  }, [registerWord, wordIndex, word]);

  const {
    anchorEl,
    popperRef,
    open,
    isClicked,
    setIsClicked,
    handleMouseEnter: baseHandleMouseEnter,
    handleMouseLeave,
    close,
  } = useTooltipInteraction({
    onClose: () => setIsEditing(false),
  });

  useEffect(() => {
    if (isDragging) {
      close();
    }
  }, [isDragging, close]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  const handleStartEdit = () => {
    setEditValue(translation || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim() || editValue === translation) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateTranslation?.(cleanWord, editValue.trim());
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
        onTranslateRequest?.();
        dragContext.startDrag(wordIndex, element);
      };

      const onUp = () => {
        removeAll();
        if (dragStarted) {
          dragContext.endDrag();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isDragEnabled, dragContext, wordIndex, onTranslateRequest]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLSpanElement>) => {
      if (!isDragEnabled) return;
      const touch = event.touches[0];
      if (!touch) return;

      const startX = touch.clientX;
      const startY = touch.clientY;
      const element = event.currentTarget;
      const THRESHOLD_SQ = 64;
      let dragStarted = false;

      const removeAll = () => {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
      };

      const onMove = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        if (dragStarted) return;
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (dx * dx + dy * dy < THRESHOLD_SQ) return;
        dragStarted = true;
        onTranslateRequest?.();
        dragContext.startDrag(wordIndex, element);
      };

      const onEnd = () => {
        removeAll();
        if (dragStarted) {
          dragContext.endDrag();
        }
      };

      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    },
    [isDragEnabled, dragContext, wordIndex, onTranslateRequest]
  );

  const handleMouseEnterWord = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      if (isDragEnabled) {
        dragContext.updateDrag(wordIndex);
      }
      if (!isDragging && !hasPhrase && !disableHoverTranslate) {
        baseHandleMouseEnter(event);
        fetchTranslation();
      }
    },
    [
      isDragEnabled,
      dragContext,
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
        dragContext?.closePhraseTooltip();
        return;
      }
      if (isDragging) return;

      if (isClicked) {
        setIsClicked(false);
        setIsEditing(false);
      } else {
        setIsClicked(true);
        onTranslateRequest?.();
        fetchTranslation();
      }
      if (event.currentTarget) {
        baseHandleMouseEnter(event);
      }
    },
    [
      hasPhrase,
      isDragging,
      isClicked,
      setIsClicked,
      fetchTranslation,
      baseHandleMouseEnter,
      dragContext,
      onTranslateRequest,
    ]
  );

  const showSingleWordTooltip = open && !isDragging && !hasPhrase;
  const WordComponent = isHighlighted ? SelectableHighlightedSpan : SelectableSpan;

  return (
    <>
      <WordComponent
        ref={spanRef}
        $isSelected={isSelected}
        data-word-index={wordIndex}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnterWord}
        onMouseLeave={handleMouseLeaveWord}
        onTouchStart={handleTouchStart}
      >
        {word}
      </WordComponent>
      <WordTooltipPopper
        open={showSingleWordTooltip}
        anchorEl={anchorEl}
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
    </>
  );
}

export const TranslatableWord = memo(TranslatableWordComponent);

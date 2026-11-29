import { useEffect, useState, useRef } from 'react';
import { Box, IconButton, Divider, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '../lib/styled';
import {
  TranslatableTextProvider,
  useTranslatableTextActions,
  useTranslatableTextUI,
} from '../contexts/TranslatableTextContext';
import { useAddToVocabulary } from '../contexts/AddToVocabularyContext';
import { useAddSentence } from '../contexts/AddSentenceContext';
import { useAuthContext } from '../contexts/AuthContext';
import { translate, translationCacheKey, wordToTranslate } from '../lib/translate';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import {
  TooltipContent,
  TooltipIconButton,
  TranslationTooltipBody,
  useTooltipTranslation,
  WordTooltipPopper,
} from './shared';

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
  onUpdateTranslation?: (phrase: string, translation: string) => void;
}

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
  onUpdateTranslation,
}: PhraseTooltipProps) {
  const { closePhraseTooltip, getSelectedIndices } = useTranslatableTextActions();
  const { selectedPhrase, phraseAnchorEl } = useTranslatableTextUI();
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);
  const { translation, error, loading, show, lookUp } = useTooltipTranslation(
    selectedPhrase,
    closePhraseTooltip
  );

  if (!selectedPhrase && showSaveMenu) setShowSaveMenu(false);

  const getSentenceContextRef = useRef(getSentenceContext);
  useEffect(() => {
    getSentenceContextRef.current = getSentenceContext;
  });

  const handleAddToVocabulary = () => {
    if (selectedPhrase && addToVocabulary) {
      addToVocabulary.openAddToVocabulary(selectedPhrase, translation || '');
      closePhraseTooltip();
    }
  };

  const handleAddSentence = () => {
    if (selectedPhrase && addSentence) {
      addSentence.openAddSentence({ polish: selectedPhrase, english: translation || '' });
      closePhraseTooltip();
    }
  };

  useEffect(() => {
    if (!selectedPhrase) {
      show(null);
      return;
    }

    const cacheKey = translationCacheKey(selectedPhrase);
    const cachedTranslation = translations?.[cacheKey];
    if (cachedTranslation) {
      show(cachedTranslation);
      return;
    }

    const dynamicContext = getSentenceContextRef.current?.(getSelectedIndices());
    lookUp(
      translate(selectedPhrase, 'EN', {
        context: dynamicContext ?? sentenceContext,
        declensionCardId,
        sentenceId,
      })
    ).then((result) => {
      if (result !== null) onUpdateTranslation?.(cacheKey, result);
    });
  }, [
    selectedPhrase,
    sentenceContext,
    translations,
    declensionCardId,
    sentenceId,
    onUpdateTranslation,
    getSelectedIndices,
    show,
    lookUp,
  ]);

  useDismissOnOutsideClick(
    !!selectedPhrase,
    (target) => !popperRef.current || popperRef.current.contains(target),
    closePhraseTooltip
  );

  if (!selectedPhrase || !phraseAnchorEl) return null;

  return (
    <WordTooltipPopper open={true} anchorEl={phraseAnchorEl} popperRef={popperRef}>
      <TooltipContent>
        <TranslationTooltipBody
          text={selectedPhrase}
          translation={translation}
          error={error}
          loading={loading}
          iconSize={16}
        >
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
        </TranslationTooltipBody>
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

interface WordTooltipProps {
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

function WordTooltip({
  translations,
  declensionCardId,
  sentenceId,
  onUpdateTranslation,
}: WordTooltipProps) {
  const { closeWordTooltip } = useTranslatableTextActions();
  const { activeWord } = useTranslatableTextUI();
  const addToVocabulary = useAddToVocabulary();
  const { isAdmin } = useAuthContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const text = activeWord ? wordToTranslate(activeWord.word) : null;
  const { translation, error, loading, show, lookUp } = useTooltipTranslation(
    text,
    closeWordTooltip
  );

  useEffect(() => {
    if (!activeWord) {
      show(null);
      setIsEditing(false);
      return;
    }

    // A token of punctuation alone has nothing to look up.
    if (!text) {
      show(null);
      return;
    }

    const knownTranslation =
      translations?.[translationCacheKey(activeWord.word)] ?? activeWord.translation;
    if (knownTranslation) {
      show(knownTranslation);
      return;
    }

    lookUp(
      activeWord.pendingTranslation ??
        translate(text, 'EN', {
          context: activeWord.sentenceContext,
          declensionCardId,
          sentenceId,
        })
    );
  }, [activeWord, text, translations, declensionCardId, sentenceId, show, lookUp]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useDismissOnOutsideClick(
    !!activeWord,
    (target) =>
      !!popperRef.current?.contains(target) ||
      !!activeWord?.anchorEl.contains(target) ||
      (target instanceof Element && !!target.closest('[data-word-index]')),
    closeWordTooltip
  );

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
      await onUpdateTranslation?.(translationCacheKey(activeWord.word), editValue.trim());
      show(editValue.trim());
      setIsEditing(false);
    } catch {
      show(translation, 'Save failed');
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
      closeWordTooltip();
    }
  };

  if (!activeWord) return null;

  return (
    <WordTooltipPopper open={true} anchorEl={activeWord.anchorEl} popperRef={popperRef}>
      <TooltipContent>
        {isEditing && !loading && !isSaving ? (
          <EditInput
            size="small"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <TooltipIconButton size="small" onClick={handleSaveEdit}>
                    <CheckIcon sx={{ fontSize: 14 }} />
                  </TooltipIconButton>
                  <TooltipIconButton size="small" onClick={handleCancelEdit}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </TooltipIconButton>
                </InputAdornment>
              ),
            }}
          />
        ) : (
          <TranslationTooltipBody
            text={activeWord.word}
            translation={translation}
            error={error}
            loading={loading || isSaving}
            iconSize={14}
            beforeCopy={
              isAdmin &&
              translation && (
                <EditButton size="small" onClick={handleStartEdit}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </EditButton>
              )
            }
            onAddToVocabulary={addToVocabulary ? handleAddToVocabulary : undefined}
          />
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
  onUpdateTranslation,
  onWordTap,
}: TranslatableTextProps) {
  return (
    <TranslatableTextProvider
      onWordTap={onWordTap}
      overlays={
        <>
          <WordTooltip
            translations={translations}
            declensionCardId={declensionCardId}
            sentenceId={sentenceId}
            onUpdateTranslation={onUpdateTranslation}
          />
          <PhraseTooltip
            sentenceContext={sentenceContext}
            getSentenceContext={getSentenceContext}
            translations={translations}
            declensionCardId={declensionCardId}
            sentenceId={sentenceId}
            onUpdateTranslation={onUpdateTranslation}
          />
        </>
      }
    >
      <TranslatableTextInner>{children}</TranslatableTextInner>
    </TranslatableTextProvider>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Popper,
  Paper,
  Typography,
  styled,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  translate,
  RateLimitMinuteError,
  RateLimitDailyError,
} from '../lib/translate';

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
  color: theme.palette.tooltip.text,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

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

const TooltipPaper = styled(Paper)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.tooltip.main,
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
    borderTop: `6px solid ${theme.palette.tooltip.main}`,
  },
}));

export interface TappableWordProps {
  word: string;
  sentenceContext?: string;
  isHighlighted?: boolean;
  translations?: Record<string, string>;
  declensionCardId?: number;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
  isAdmin?: boolean;
}

export function TappableWord({
  word,
  sentenceContext,
  isHighlighted,
  translations,
  declensionCardId,
  onDailyLimitReached,
  onUpdateTranslation,
  isAdmin = false,
}: TappableWordProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLSpanElement | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, anchorEl]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const cleanWord = word.replace(/[.,!?;:"""''()]/g, '').toLowerCase();

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

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLSpanElement>) => {
      const target = event.currentTarget;

      if (anchorEl) {
        setAnchorEl(null);
        setIsEditing(false);
        return;
      }

      setAnchorEl(target);
      setError(null);

      if (!cleanWord) {
        setAnchorEl(null);
        return;
      }

      const cachedTranslation = translations?.[cleanWord];
      if (cachedTranslation) {
        setTranslation(cachedTranslation);
        return;
      }

      setLoading(true);
      setTranslation(null);

      try {
        const result = await translate(
          cleanWord,
          'EN',
          sentenceContext,
          declensionCardId
        );
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
    [
      anchorEl,
      cleanWord,
      sentenceContext,
      translations,
      declensionCardId,
      onDailyLimitReached,
    ]
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
            {loading || isSaving ? (
              <CircularProgress size={16} sx={{ color: 'tooltip.text' }} />
            ) : error ? (
              <Typography variant="caption" sx={{ color: 'tooltip.error' }}>
                {error}
              </Typography>
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
                <Typography variant="body2" fontWeight={500}>
                  {translation}
                </Typography>
                {isAdmin && translation && (
                  <EditButton size="small" onClick={handleStartEdit}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </EditButton>
                )}
              </>
            )}
          </PopoverContent>
        </TooltipPaper>
      </Popper>
    </>
  );
}

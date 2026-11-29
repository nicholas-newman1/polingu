import type { ReactNode } from 'react';
import { CircularProgress, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { styled } from '../../lib/styled';
import { useSnackbar } from '../../contexts/SnackbarContext';

export const TooltipIconButton = styled(IconButton)(({ theme }) => ({
  padding: 2,
  color: theme.palette.tooltip.text,
  '&:hover': {
    backgroundColor: 'transparent',
  },
}));

interface TranslationTooltipBodyProps {
  /** The Polish word or phrase, which the copy button copies. */
  text: string;
  translation: string | null;
  error: string | null;
  loading: boolean;
  iconSize: number;
  /** Shown between the translation and the copy button. */
  beforeCopy?: ReactNode;
  /** Without it there is no add-to-vocabulary button. */
  onAddToVocabulary?: () => void;
  /** Shown after the other buttons. */
  children?: ReactNode;
}

/** A word or phrase tooltip's content: a spinner, or the translation (or error) and its buttons. */
export function TranslationTooltipBody({
  text,
  translation,
  error,
  loading,
  iconSize,
  beforeCopy,
  onAddToVocabulary,
  children,
}: TranslationTooltipBodyProps) {
  const { showSnackbar } = useSnackbar();

  if (loading) return <CircularProgress size={16} sx={{ color: 'tooltip.text' }} />;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar('Copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy', 'error');
    }
  };

  return (
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
      {beforeCopy}
      <TooltipIconButton size="small" onClick={handleCopy} aria-label="Copy to clipboard">
        <ContentCopyIcon sx={{ fontSize: iconSize }} />
      </TooltipIconButton>
      {onAddToVocabulary && (
        <TooltipIconButton size="small" onClick={onAddToVocabulary} aria-label="Add to vocabulary">
          <AddIcon sx={{ fontSize: iconSize }} />
        </TooltipIconButton>
      )}
      {children}
    </>
  );
}

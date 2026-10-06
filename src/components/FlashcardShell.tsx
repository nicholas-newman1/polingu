import { useEffect, useState, type ReactNode } from 'react';
import { Box, Button, Divider, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplayIcon from '@mui/icons-material/Replay';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { Grade } from 'ts-fsrs';
import { RatingButtons, type RatingIntervals } from './RatingButtons';
import { BoxIconButton } from './BoxIconButton';
import { FlashcardSurface, FlashcardWrapper } from './flashcardStyles';

/** Session-control props every review flashcard forwards to `FlashcardShell`. */
export interface ReviewFlashcardProps {
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: RatingIntervals;
  reassessIntervals?: RatingIntervals;
  onRate?: (rating: Grade) => void;
  onReassess?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
}

interface FlashcardShellProps extends ReviewFlashcardProps {
  revealed: boolean;
  maxWidth?: number;
  canEdit?: boolean;
  onReveal: () => void;
  onDelete?: () => void;
  header?: ReactNode;
  headerActions?: ReactNode;
  question: ReactNode;
  answer: ReactNode;
}

const NextButton = styled(Button)(({ theme }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

const RevealButton = styled(Button)(({ theme }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette.primary.main,
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const CardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

const BackButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  padding: theme.spacing(1.5, 2),
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
  },
}));

const ReassessButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  padding: theme.spacing(1.5, 2),
  backgroundColor: alpha(theme.palette.warning.main, 0.15),
  color: theme.palette.warning.dark,
  '&:hover': {
    backgroundColor: alpha(theme.palette.warning.main, 0.25),
  },
}));

const ContinueButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

export function FlashcardShell({
  revealed,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  reassessIntervals,
  maxWidth = 420,
  canEdit = false,
  onReveal,
  onRate,
  onReassess,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onDelete,
  header,
  headerActions,
  question,
  answer,
}: FlashcardShellProps) {
  const [isReassessing, setIsReassessing] = useState(false);
  const showBackButton = canGoBack && !practiceMode;

  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [revealed]);

  const renderBottomActions = () => {
    if (!revealed) {
      return (
        <Stack spacing={1}>
          <RevealButton fullWidth size="large" variant="contained" onClick={onReveal}>
            Reveal Answer
          </RevealButton>
          {showBackButton && (
            <BackButton fullWidth variant="contained" onClick={onGoBack}>
              <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
              Previous Card
            </BackButton>
          )}
        </Stack>
      );
    }

    if (practiceMode) {
      return (
        <NextButton fullWidth size="large" variant="contained" onClick={onNext}>
          Next Card →
        </NextButton>
      );
    }

    if (isViewingHistory) {
      if (isReassessing && onReassess) {
        return (
          <Stack spacing={1}>
            <RatingButtons
              intervals={reassessIntervals}
              onRate={(rating) => {
                setIsReassessing(false);
                onReassess(rating);
              }}
            />
            <BackButton fullWidth variant="contained" onClick={() => setIsReassessing(false)}>
              Cancel
            </BackButton>
          </Stack>
        );
      }

      return (
        <Stack spacing={1}>
          <ContinueButton fullWidth size="large" variant="contained" onClick={onContinue}>
            Continue →
          </ContinueButton>
          {onReassess && (
            <ReassessButton fullWidth variant="contained" onClick={() => setIsReassessing(true)}>
              <ReplayIcon fontSize="small" sx={{ mr: 0.5 }} />
              Re-assess difficulty
            </ReassessButton>
          )}
          {showBackButton && (
            <BackButton fullWidth variant="contained" onClick={onGoBack}>
              <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
              Previous Card
            </BackButton>
          )}
        </Stack>
      );
    }

    return (
      <Stack spacing={1}>
        <RatingButtons intervals={intervals} onRate={onRate!} />
        {showBackButton && (
          <BackButton fullWidth variant="contained" onClick={onGoBack}>
            <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
            Previous Card
          </BackButton>
        )}
      </Stack>
    );
  };

  return (
    <FlashcardWrapper $maxWidth={maxWidth} className="animate-fade-up">
      <FlashcardSurface>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CardHeader>
            {(headerActions || canEdit) && (
              <ActionButtons>
                {headerActions}
                {canEdit && (
                  <>
                    <BoxIconButton onClick={onEdit} size="small" aria-label="edit">
                      <EditIcon fontSize="small" />
                    </BoxIconButton>
                    <BoxIconButton
                      tone="danger"
                      onClick={onDelete}
                      size="small"
                      aria-label="delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </BoxIconButton>
                  </>
                )}
              </ActionButtons>
            )}
            <Box sx={{ flex: 1 }}>{header}</Box>
          </CardHeader>

          {question}

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
              {answer}
            </Box>
          )}
        </Box>

        {renderBottomActions()}
      </FlashcardSurface>
    </FlashcardWrapper>
  );
}

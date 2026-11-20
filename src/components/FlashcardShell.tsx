import { useEffect, type ReactNode } from 'react';
import { Box, Button, Divider, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { Grade } from 'ts-fsrs';
import { RatingButtons, type RatingIntervals } from './RatingButtons';
import { BoxIconButton } from './BoxIconButton';
import { FlashcardSurface, FlashcardWrapper } from './flashcardStyles';
import { CardStackLayers } from './CardStackLayers';
import {
  ratingToCompletionOutcome,
  useCardCompletion,
  type CardCompletionOutcome,
} from '../hooks/useCardCompletion';

/** Session-control props every review flashcard forwards to `FlashcardShell`. */
export interface ReviewFlashcardProps {
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  remainingCount?: number;
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

const ContinueButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

function getStackDepth(
  isViewingHistory: boolean,
  practiceMode: boolean,
  remainingCount?: number
): number {
  if (isViewingHistory) return 0;
  if (practiceMode) return 2;
  if (remainingCount === undefined) return 1;
  return Math.max(0, Math.min(2, remainingCount - 1));
}

interface FlashcardBottomActionsProps {
  revealed: boolean;
  practiceMode: boolean;
  isViewingHistory: boolean;
  showBackButton: boolean;
  intervals?: RatingIntervals;
  reassessIntervals?: RatingIntervals;
  onReveal: () => void;
  onTriggerExit: (outcome: CardCompletionOutcome, onComplete: () => void) => void;
  onRate?: (rating: Grade) => void;
  onReassess?: (rating: Grade) => void;
  onNext?: () => void;
  onContinue?: () => void;
  onGoBack?: () => void;
}

function FlashcardBottomActions({
  revealed,
  practiceMode,
  isViewingHistory,
  showBackButton,
  intervals,
  reassessIntervals,
  onReveal,
  onTriggerExit,
  onRate,
  onReassess,
  onNext,
  onContinue,
  onGoBack,
}: FlashcardBottomActionsProps) {
  const backButton = showBackButton && (
    <BackButton fullWidth variant="contained" onClick={onGoBack}>
      <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
      Previous Card
    </BackButton>
  );

  if (!revealed) {
    return (
      <Stack spacing={1}>
        <RevealButton fullWidth size="large" variant="contained" onClick={onReveal}>
          Reveal Answer
        </RevealButton>
        {backButton}
      </Stack>
    );
  }

  if (practiceMode) {
    return (
      <NextButton
        fullWidth
        size="large"
        variant="contained"
        onClick={() => onNext && onTriggerExit('next', onNext)}
      >
        Next Card →
      </NextButton>
    );
  }

  if (isViewingHistory) {
    return (
      <Stack spacing={1}>
        <ContinueButton
          fullWidth
          size="large"
          variant="contained"
          onClick={() => onContinue && onTriggerExit('next', onContinue)}
        >
          Continue →
        </ContinueButton>
        {onReassess && (
          <RatingButtons
            intervals={reassessIntervals}
            onRate={(rating) =>
              onTriggerExit(ratingToCompletionOutcome(rating), () => onReassess(rating))
            }
          />
        )}
        {backButton}
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <RatingButtons
        intervals={intervals}
        onRate={(rating) =>
          onRate && onTriggerExit(ratingToCompletionOutcome(rating), () => onRate(rating))
        }
      />
      {backButton}
    </Stack>
  );
}

interface FlashcardHeaderBarProps {
  header?: React.ReactNode;
  headerActions?: React.ReactNode;
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function FlashcardHeaderBar({
  header,
  headerActions,
  canEdit,
  onEdit,
  onDelete,
}: FlashcardHeaderBarProps) {
  return (
    <CardHeader>
      {(headerActions || canEdit) && (
        <ActionButtons>
          {headerActions}
          {canEdit && (
            <>
              <BoxIconButton onClick={onEdit} size="small" aria-label="edit">
                <EditIcon fontSize="small" />
              </BoxIconButton>
              <BoxIconButton tone="danger" onClick={onDelete} size="small" aria-label="delete">
                <DeleteIcon fontSize="small" />
              </BoxIconButton>
            </>
          )}
        </ActionButtons>
      )}
      <Box sx={{ flex: 1 }}>{header}</Box>
    </CardHeader>
  );
}

export function FlashcardShell({
  revealed,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  remainingCount,
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
  const { surfaceRef, promoted, trigger: triggerExit } = useCardCompletion();
  const stackDepth = getStackDepth(isViewingHistory, practiceMode, remainingCount);
  const isPromotedFromStack = promoted && !isViewingHistory;

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

  return (
    <FlashcardWrapper
      $maxWidth={maxWidth}
      $hasStack={stackDepth > 0}
      className={isPromotedFromStack ? undefined : 'animate-card-enter'}
    >
      <CardStackLayers depth={stackDepth} promoted={isPromotedFromStack} />
      <FlashcardSurface ref={surfaceRef} $promoted={isPromotedFromStack}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', mb: 2 }}>
          <FlashcardHeaderBar
            header={header}
            headerActions={headerActions}
            canEdit={canEdit}
            onEdit={onEdit}
            onDelete={onDelete}
          />

          {question}

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
              {answer}
            </Box>
          )}
        </Box>

        <FlashcardBottomActions
          revealed={revealed}
          practiceMode={practiceMode}
          isViewingHistory={isViewingHistory}
          showBackButton={canGoBack && !practiceMode}
          intervals={intervals}
          reassessIntervals={reassessIntervals}
          onReveal={onReveal}
          onTriggerExit={triggerExit}
          onRate={onRate}
          onReassess={onReassess}
          onNext={onNext}
          onContinue={onContinue}
          onGoBack={onGoBack}
        />
      </FlashcardSurface>
    </FlashcardWrapper>
  );
}

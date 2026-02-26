import type { ReactNode } from 'react';
import { Box, Button, Card, Divider, IconButton, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { Grade } from 'ts-fsrs';
import { RatingButtons, type RatingIntervals } from './RatingButtons';

type AccentColor = 'primary' | 'warning' | 'success' | 'info' | 'error' | 'secondary';

interface FlashcardShellProps {
  revealed: boolean;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: RatingIntervals;
  accentColor?: AccentColor;
  maxWidth?: number;
  canEdit?: boolean;
  onReveal: () => void;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  header?: ReactNode;
  question: ReactNode;
  answer: ReactNode;
}

const CardWrapper = styled(Box)<{ $maxWidth: number }>(({ $maxWidth }) => ({
  width: '100%',
  maxWidth: $maxWidth,
  margin: '0 auto',
}));

const StyledCard = styled(Card)<{ $accentColor: AccentColor }>(({ theme, $accentColor }) => ({
  padding: theme.spacing(3),
  minHeight: 420,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  boxShadow: `0 8px 32px ${alpha(theme.palette[$accentColor].main, 0.4)}`,
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
    minHeight: 460,
  },
}));

const NextButton = styled(Button)(({ theme }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

const RevealButton = styled(Button)<{ $accentColor: AccentColor }>(({ theme, $accentColor }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette[$accentColor].main,
  boxShadow: `0 4px 14px ${alpha(theme.palette[$accentColor].main, 0.3)}`,
  '&:hover': {
    backgroundColor: theme.palette[$accentColor].dark,
  },
}));

const CardHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
});

const ActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(-1),
  marginRight: theme.spacing(-1),
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.disabled,
  padding: theme.spacing(0.75),
  '&:hover': {
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.text.primary, 0.05),
  },
}));

const DeleteButton = styled(ActionButton)(({ theme }) => ({
  '&:hover': {
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.1),
  },
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

export function FlashcardShell({
  revealed,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  accentColor = 'primary',
  maxWidth = 420,
  canEdit = false,
  onReveal,
  onRate,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onDelete,
  header,
  question,
  answer,
}: FlashcardShellProps) {
  const showBackButton = canGoBack && !practiceMode;

  const renderBottomActions = () => {
    if (!revealed) {
      return (
        <Stack spacing={1}>
          <RevealButton
            $accentColor={accentColor}
            fullWidth
            size="large"
            variant="contained"
            onClick={onReveal}
          >
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
      return (
        <Stack spacing={1}>
          <ContinueButton fullWidth size="large" variant="contained" onClick={onContinue}>
            Continue →
          </ContinueButton>
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
    <CardWrapper $maxWidth={maxWidth} className="animate-fade-up">
      <StyledCard $accentColor={accentColor}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CardHeader>
            <Box sx={{ flex: 1 }}>{header}</Box>
            {canEdit && !isViewingHistory && (
              <ActionButtons>
                <ActionButton onClick={onEdit} size="small" aria-label="edit">
                  <EditIcon fontSize="small" />
                </ActionButton>
                <DeleteButton onClick={onDelete} size="small" aria-label="delete">
                  <DeleteIcon fontSize="small" />
                </DeleteButton>
              </ActionButtons>
            )}
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
      </StyledCard>
    </CardWrapper>
  );
}

import { useState, useMemo } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, Button, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '../lib/styled';
import { renderTappableText } from '../lib/renderTappableText';
import type { Sentence, SentenceDirection, CEFRLevel } from '../types/sentences';
import { alpha } from '../lib/theme';

export interface RatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface SentenceFlashcardProps {
  sentence: Sentence;
  direction: SentenceDirection;
  practiceMode?: boolean;
  intervals?: RatingIntervals;
  canEdit?: boolean;
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

const CardWrapper = styled(Box)({
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
});

const StyledCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  minHeight: 420,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  borderRadius: theme.spacing(2),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
    minHeight: 460,
  },
}));

const DirectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

const LevelChip = styled(Chip)<{ $level: CEFRLevel }>(({ theme, $level }) => ({
  backgroundColor: theme.palette.levels[$level],
  color: theme.palette.common.white,
  fontWeight: 600,
  fontSize: '0.7rem',
  height: 22,
}));

const TagChip = styled(Chip)(({ theme }) => ({
  height: 22,
  fontSize: '0.7rem',
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));

const SentenceText = styled(Box)(({ theme }) => ({
  fontSize: '1.35rem',
  lineHeight: 1.6,
  fontWeight: 400,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.15rem',
  },
}));

const AnswerText = styled(Box)(({ theme }) => ({
  fontSize: '1.25rem',
  lineHeight: 1.5,
  fontWeight: 500,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.1rem',
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

const NextButton = styled(Button)(({ theme }) => ({
  marginTop: 'auto',
  backgroundColor: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

interface RatingButtonProps {
  $ratingColor: 'primary' | 'warning' | 'success' | 'info';
}

const RatingButton = styled(Button)<RatingButtonProps>(
  ({ theme, $ratingColor }) => ({
    flexDirection: 'column',
    padding: theme.spacing(1.5, 1),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette[$ratingColor].main,
    '&:hover': {
      backgroundColor: theme.palette[$ratingColor].dark,
    },
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(2, 1),
    },
  })
);

const IntervalText = styled(Typography)({
  opacity: 0.8,
  fontFamily: '"JetBrains Mono", monospace',
});

const CardHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'flex-end',
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

export function SentenceFlashcard({
  sentence,
  direction,
  practiceMode = false,
  intervals,
  canEdit = false,
  isAdmin = false,
  onRate,
  onNext,
  onEdit,
  onDelete,
  onDailyLimitReached,
  onUpdateTranslation,
}: SentenceFlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  const isPolishToEnglish = direction === 'pl-to-en';
  const directionLabel = isPolishToEnglish
    ? 'Polish → English'
    : 'English → Polish';

  const tappableTextOptions = useMemo(
    () => ({
      translations: sentence.translations,
      sentenceId: sentence.id,
      onDailyLimitReached,
      onUpdateTranslation,
      sentenceContext: sentence.polish,
      isAdmin,
    }),
    [
      sentence.translations,
      sentence.id,
      sentence.polish,
      onDailyLimitReached,
      onUpdateTranslation,
      isAdmin,
    ]
  );

  const questionContent = isPolishToEnglish
    ? renderTappableText(sentence.polish, tappableTextOptions)
    : sentence.english;

  const answerContent = isPolishToEnglish
    ? sentence.english
    : renderTappableText(sentence.polish, tappableTextOptions);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this sentence?')) {
      onDelete?.();
    }
  };

  return (
    <CardWrapper className="animate-fade-up">
      <StyledCard>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {canEdit && (
            <CardHeader>
              <ActionButtons>
                <ActionButton onClick={onEdit} size="small" aria-label="edit">
                  <EditIcon fontSize="small" />
                </ActionButton>
                <DeleteButton onClick={handleDelete} size="small" aria-label="delete">
                  <DeleteIcon fontSize="small" />
                </DeleteButton>
              </ActionButtons>
            </CardHeader>
          )}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.5,
            }}
          >
            <DirectionLabel>{directionLabel}</DirectionLabel>
            <LevelChip $level={sentence.level} label={sentence.level} />
          </Box>

          <SentenceText sx={{ mb: 2 }}>
            {questionContent}
          </SentenceText>

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2, sm: 2.5 } }} />

              <AnswerText sx={{ mb: 2 }}>
                {answerContent}
              </AnswerText>

              <Stack
                direction="row"
                spacing={0.5}
                sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {sentence.tags.map((tag) => (
                  <TagChip key={tag} label={tag} size="small" />
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {revealed ? (
          practiceMode ? (
            <NextButton
              fullWidth
              size="large"
              variant="contained"
              onClick={onNext}
            >
              Next Card →
            </NextButton>
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ mt: 'auto' }}>
              <RatingButton
                fullWidth
                variant="contained"
                $ratingColor="primary"
                onClick={() => onRate?.(Rating.Again)}
              >
                <Typography variant="body2" fontWeight={600}>
                  Again
                </Typography>
                <IntervalText variant="caption">
                  {intervals?.[Rating.Again]}
                </IntervalText>
              </RatingButton>
              <RatingButton
                fullWidth
                variant="contained"
                $ratingColor="warning"
                onClick={() => onRate?.(Rating.Hard)}
              >
                <Typography variant="body2" fontWeight={600}>
                  Hard
                </Typography>
                <IntervalText variant="caption">
                  {intervals?.[Rating.Hard]}
                </IntervalText>
              </RatingButton>
              <RatingButton
                fullWidth
                variant="contained"
                $ratingColor="success"
                onClick={() => onRate?.(Rating.Good)}
              >
                <Typography variant="body2" fontWeight={600}>
                  Good
                </Typography>
                <IntervalText variant="caption">
                  {intervals?.[Rating.Good]}
                </IntervalText>
              </RatingButton>
              <RatingButton
                fullWidth
                variant="contained"
                $ratingColor="info"
                onClick={() => onRate?.(Rating.Easy)}
              >
                <Typography variant="body2" fontWeight={600}>
                  Easy
                </Typography>
                <IntervalText variant="caption">
                  {intervals?.[Rating.Easy]}
                </IntervalText>
              </RatingButton>
            </Stack>
          )
        ) : (
          <RevealButton
            fullWidth
            size="large"
            variant="contained"
            onClick={() => setRevealed(true)}
          >
            Reveal Answer
          </RevealButton>
        )}
      </StyledCard>
    </CardWrapper>
  );
}


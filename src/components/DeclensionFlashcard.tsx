import { useState, useMemo } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { styled } from '../lib/styled';
import type { DeclensionCard } from '../types';
import { renderTappableText } from '../lib/renderTappableText';
import { useTranslationContext } from '../hooks/useTranslationContext';
import { alpha } from '../lib/theme';

export interface DeclensionRatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface DeclensionFlashcardProps {
  card: DeclensionCard;
  practiceMode?: boolean;
  intervals?: DeclensionRatingIntervals;
  canEdit?: boolean;
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onEdit?: () => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

const CardWrapper = styled(Box)({
  width: '100%',
  maxWidth: 420,
  margin: '0 auto',
});

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  minHeight: 420,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
    minHeight: 460,
  },
}));

const QuestionText = styled(Typography)({
  fontWeight: 300,
  lineHeight: 1.5,
  flex: 1,
});

const AnswerText = styled(Typography)({
  fontWeight: 500,
});

const MetaChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.secondary,
}));

const HintText = styled(Typography)({
  fontStyle: 'italic',
});

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
  justifyContent: 'space-between',
  alignItems: 'flex-start',
});

const CustomLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.disabled,
  padding: theme.spacing(0.75),
  marginTop: theme.spacing(-1),
  marginRight: theme.spacing(-1),
  '&:hover': {
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.text.primary, 0.05),
  },
}));

export function DeclensionFlashcard({
  card,
  practiceMode = false,
  intervals,
  canEdit = false,
  isAdmin = false,
  onRate,
  onNext,
  onEdit,
  onUpdateTranslation,
}: DeclensionFlashcardProps) {
  const [revealed, setRevealed] = useState(false);
  const { handleDailyLimitReached } = useTranslationContext();

  const declensionCardId = typeof card.id === 'number' ? card.id : undefined;

  const tappableTextOptions = useMemo(
    () => ({
      translations: card.translations,
      declensionCardId,
      onDailyLimitReached: handleDailyLimitReached,
      onUpdateTranslation,
      sentenceContext: card.back,
      isAdmin,
    }),
    [
      handleDailyLimitReached,
      card.back,
      card.translations,
      declensionCardId,
      onUpdateTranslation,
      isAdmin,
    ]
  );

  return (
    <CardWrapper className="animate-fade-up">
      <StyledCard>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {(card.isCustom || canEdit) && (
            <CardHeader>
              {card.isCustom ? <CustomLabel>Custom</CustomLabel> : <Box />}
              {canEdit && (
                <ActionButton onClick={onEdit} size="small" aria-label="edit">
                  <EditIcon fontSize="small" />
                </ActionButton>
              )}
            </CardHeader>
          )}
          <QuestionText variant="h5" color="text.primary">
            {renderTappableText(card.front, tappableTextOptions)}
          </QuestionText>

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />

              <AnswerText variant="h4" color="text.primary" sx={{ mb: 2 }}>
                {renderTappableText(
                  card.back,
                  tappableTextOptions,
                  card.declined
                )}
              </AnswerText>

              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
              >
                <MetaChip label={card.case} size="small" />
                <MetaChip label={card.gender} size="small" />
                <MetaChip label={card.number} size="small" />
              </Stack>

              {card.hint && (
                <HintText variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                  💡 {card.hint}
                </HintText>
              )}
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

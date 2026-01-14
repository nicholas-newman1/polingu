import { useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
  styled,
} from '@mui/material';
import type { VocabularyWord, VocabularyDirection } from '../types/vocabulary';

export interface RatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface VocabularyFlashcardProps {
  word: VocabularyWord;
  direction: VocabularyDirection;
  practiceMode?: boolean;
  intervals?: RatingIntervals;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
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
  backgroundColor: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 32px rgba(194, 58, 34, 0.4)',
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
  marginBottom: theme.spacing(1),
}));

const QuestionText = styled(Typography)({
  fontWeight: 400,
  lineHeight: 1.4,
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

const RevealButton = styled(Button)({
  marginTop: 'auto',
  backgroundColor: '#c23a22',
  boxShadow: '0 4px 14px rgba(194, 58, 34, 0.3)',
  '&:hover': {
    backgroundColor: '#a03018',
  },
});

interface RatingButtonProps {
  ratingColor: 'primary' | 'warning' | 'success' | 'info';
}

const RatingButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'ratingColor',
})<RatingButtonProps>(({ theme, ratingColor }) => ({
  flexDirection: 'column',
  padding: theme.spacing(1.5, 1),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette[ratingColor].main,
  '&:hover': {
    backgroundColor: theme.palette[ratingColor].dark,
  },
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2, 1),
  },
}));

const IntervalText = styled(Typography)({
  opacity: 0.8,
  fontFamily: '"JetBrains Mono", monospace',
});

function formatPartOfSpeech(pos: string): string {
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

export function VocabularyFlashcard({
  word,
  direction,
  practiceMode = false,
  intervals,
  onRate,
  onNext,
}: VocabularyFlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  const isPolishToEnglish = direction === 'pl-en';
  const questionWord = isPolishToEnglish ? word.polish : word.english;
  const answerWord = isPolishToEnglish ? word.english : word.polish;
  const directionLabel = isPolishToEnglish ? 'Polish → English' : 'English → Polish';

  return (
    <CardWrapper className="animate-fade-up">
      <StyledCard>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <DirectionLabel>{directionLabel}</DirectionLabel>
          
          <QuestionText variant="h4" color="text.primary" sx={{ mb: 2 }}>
            {questionWord}
          </QuestionText>

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />

              <AnswerText variant="h4" color="text.primary" sx={{ mb: 2 }}>
                {answerWord}
              </AnswerText>

              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
              >
                <MetaChip label={formatPartOfSpeech(word.partOfSpeech)} size="small" />
                {word.gender && (
                  <MetaChip label={word.gender} size="small" />
                )}
                <MetaChip label={`#${word.id}`} size="small" variant="outlined" />
              </Stack>

              {word.notes && (
                <HintText variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                  💡 {word.notes}
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
                ratingColor="primary"
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
                ratingColor="warning"
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
                ratingColor="success"
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
                ratingColor="info"
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


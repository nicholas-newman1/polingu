import { useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, Button, Card, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '../lib/styled';
import type { VocabularyWord, VocabularyDirection } from '../types/vocabulary';
import { alpha } from '../lib/theme';

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
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

const DirectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

const CustomLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

const HeaderLabels = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
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

const ExamplesList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

const ExampleItem = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});

const ExampleNumber = styled('span')(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: '0.75rem',
  marginRight: theme.spacing(0.5),
  minWidth: '1.25rem',
}));

const ExamplePrimary = styled('span')(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
}));

const ExampleTranslation = styled(Typography)(({ theme }) => ({
  paddingLeft: theme.spacing(2.5),
  marginTop: theme.spacing(0.25),
  '&::before': {
    content: '"→"',
    marginRight: theme.spacing(0.75),
    opacity: 0.5,
  },
}));

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

const RatingButton = styled(Button)<RatingButtonProps>(({ theme, $ratingColor }) => ({
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
}));

const IntervalText = styled(Typography)({
  opacity: 0.8,
  fontFamily: '"JetBrains Mono", monospace',
});

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

function formatPartOfSpeech(pos: string): string {
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

export function VocabularyFlashcard({
  word,
  direction,
  practiceMode = false,
  intervals,
  isAdmin = false,
  onRate,
  onNext,
  onEdit,
  onDelete,
}: VocabularyFlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  const isPolishToEnglish = direction === 'pl-to-en';
  const questionWord = isPolishToEnglish ? word.polish : word.english;
  const answerWord = isPolishToEnglish ? word.english : word.polish;
  const directionLabel = isPolishToEnglish ? 'Polish → English' : 'English → Polish';
  const isCustomWord = word.isCustom === true;
  const canEditOrDelete = isCustomWord || isAdmin;

  return (
    <CardWrapper className="animate-fade-up">
      <StyledCard>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CardHeader>
            <HeaderLabels>
              <DirectionLabel>{directionLabel}</DirectionLabel>
              {isCustomWord && <CustomLabel>Custom</CustomLabel>}
            </HeaderLabels>
            {canEditOrDelete && (
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

          <QuestionText variant="h4" color="text.primary" sx={{ mb: 2 }}>
            {questionWord}
          </QuestionText>

          {word.examples && word.examples.length > 0 && (
            <ExamplesList>
              {word.examples.map((example, index) => {
                const primaryText = isPolishToEnglish ? example.polish : example.english;
                const translationText = isPolishToEnglish ? example.english : example.polish;
                return (
                  <ExampleItem key={index}>
                    <Box>
                      <ExampleNumber>{index + 1}.</ExampleNumber>
                      <ExamplePrimary>{primaryText}</ExamplePrimary>
                    </Box>
                    {revealed && (
                      <ExampleTranslation
                        variant="body2"
                        color="text.disabled"
                        className="animate-fade-up"
                      >
                        {translationText}
                      </ExampleTranslation>
                    )}
                  </ExampleItem>
                );
              })}
            </ExamplesList>
          )}

          {revealed && (
            <Box className="animate-fade-up">
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />

              <AnswerText variant="h4" color="text.primary" sx={{ mb: 2 }}>
                {answerWord}
              </AnswerText>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                {word.partOfSpeech && (
                  <MetaChip label={formatPartOfSpeech(word.partOfSpeech)} size="small" />
                )}
                {word.gender && <MetaChip label={word.gender} size="small" />}
              </Stack>

              {word.notes && (
                <HintText variant="body2" color="text.disabled">
                  💡 {word.notes}
                </HintText>
              )}
            </Box>
          )}
        </Box>

        {revealed ? (
          practiceMode ? (
            <NextButton fullWidth size="large" variant="contained" onClick={onNext}>
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
                <IntervalText variant="caption">{intervals?.[Rating.Again]}</IntervalText>
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
                <IntervalText variant="caption">{intervals?.[Rating.Hard]}</IntervalText>
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
                <IntervalText variant="caption">{intervals?.[Rating.Good]}</IntervalText>
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
                <IntervalText variant="caption">{intervals?.[Rating.Easy]}</IntervalText>
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

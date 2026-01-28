import { useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import type { DrillableForm, ConjugationDirection, Verb } from '../types/conjugation';
import {
  getQuestionDisplay,
  getAnswerDisplay,
  getTenseLabel,
  getAspectLabel,
  getVerbClassLabel,
} from '../lib/conjugationUtils';
import { alpha } from '../lib/theme';

export interface ConjugationRatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface ConjugationFlashcardProps {
  form: DrillableForm;
  direction: ConjugationDirection;
  aspectPairVerb?: Verb;
  practiceMode?: boolean;
  intervals?: ConjugationRatingIntervals;
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
  gap: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  boxShadow: `0 8px 32px ${alpha(theme.palette.warning.main, 0.4)}`,
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

const AlternativesText = styled(Typography)(({ theme }) => ({
  fontSize: '0.9rem',
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.5),
}));

const InfinitiveLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
  marginTop: theme.spacing(1),
}));

const MetaChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.secondary,
}));

const TenseChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.warning.main, 0.15),
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

const PluralChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.success.main, 0.15),
  color: theme.palette.success.main,
  fontWeight: 500,
}));

const AspectChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.info.main, 0.15),
  color: theme.palette.info.main,
  fontWeight: 500,
}));

const GenderChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
  color: theme.palette.primary.main,
}));

const IrregularChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.error.main, 0.15),
  color: theme.palette.error.main,
}));

const AspectPairBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.text.primary, 0.03),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${alpha(theme.palette.info.main, 0.5)}`,
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
  backgroundColor: theme.palette.warning.main,
  boxShadow: `0 4px 14px ${alpha(theme.palette.warning.main, 0.3)}`,
  '&:hover': {
    backgroundColor: theme.palette.warning.dark,
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

export function ConjugationFlashcard({
  form,
  direction,
  aspectPairVerb,
  practiceMode = false,
  intervals,
  onRate,
  onNext,
}: ConjugationFlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  const isPolishToEnglish = direction === 'pl-to-en';
  const directionLabel = isPolishToEnglish ? 'Polish → English' : 'English → Polish';

  const questionDisplay = getQuestionDisplay(form, direction);
  const answerData = getAnswerDisplay(form, direction);

  const aspectPairForm = aspectPairVerb
    ? getCorrespondingAspectPairForm(form, aspectPairVerb)
    : null;

  return (
    <CardWrapper className="animate-fade-up">
      <StyledCard>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <HeaderLabels>
            <DirectionLabel>{directionLabel}</DirectionLabel>
          </HeaderLabels>

          <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
            <TenseChip label={getTenseLabel(form.tense)} size="small" />
            {form.person === '2nd' && form.number === 'Plural' && (
              <PluralChip label="Plural" size="small" />
            )}
            {form.gender && <GenderChip label={form.gender} size="small" />}
          </Stack>

          <QuestionText variant="h4" color="text.primary" sx={{ mb: 1 }}>
            {questionDisplay}
          </QuestionText>

          {isPolishToEnglish && <InfinitiveLabel>{form.verb.infinitive}</InfinitiveLabel>}

          {revealed && (
            <Box className="animate-fade-up" sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2.5 }} />

              <AnswerText variant="h4" color="text.primary">
                {answerData.primary}
              </AnswerText>
              {answerData.alternatives && answerData.alternatives.length > 0 && (
                <AlternativesText>Also: {answerData.alternatives.join(', ')}</AlternativesText>
              )}

              {!isPolishToEnglish && <InfinitiveLabel>{form.verb.infinitive}</InfinitiveLabel>}

              <Stack direction="row" spacing={0.75} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
                <AspectChip label={getAspectLabel(form.verb.aspect)} size="small" />
                <IrregularChip label={getVerbClassLabel(form.verb.verbClass)} size="small" />
                {form.verb.isReflexive && <MetaChip label="Reflexive" size="small" />}
              </Stack>

              {aspectPairForm && aspectPairVerb && (
                <AspectPairBox>
                  <Typography variant="body2" color="text.secondary">
                    {aspectPairVerb.aspect}: <strong>{aspectPairForm}</strong>
                  </Typography>
                </AspectPairBox>
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

function getCorrespondingAspectPairForm(form: DrillableForm, aspectPairVerb: Verb): string | null {
  const { tense, formKey } = form;

  if (tense === 'present') {
    if (aspectPairVerb.aspect === 'Perfective') {
      const futureForm =
        aspectPairVerb.conjugations.future[
          formKey as keyof typeof aspectPairVerb.conjugations.future
        ];
      return futureForm?.pl ?? null;
    }
  }

  if (tense === 'future') {
    if (aspectPairVerb.aspect === 'Imperfective') {
      const presentForm =
        aspectPairVerb.conjugations.present[
          formKey as keyof typeof aspectPairVerb.conjugations.present
        ];
      return presentForm?.pl ?? null;
    } else {
      const futureForm =
        aspectPairVerb.conjugations.future[
          formKey as keyof typeof aspectPairVerb.conjugations.future
        ];
      return futureForm?.pl ?? null;
    }
  }

  const tenseConjugations = aspectPairVerb.conjugations[tense];
  if (tenseConjugations) {
    const correspondingForm = tenseConjugations[formKey as keyof typeof tenseConjugations];
    if (correspondingForm && typeof correspondingForm === 'object' && 'pl' in correspondingForm) {
      return (correspondingForm as { pl: string }).pl;
    }
  }

  return null;
}

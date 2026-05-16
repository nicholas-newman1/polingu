import { useState } from 'react';
import type { Grade } from 'ts-fsrs';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell } from '../../../components/FlashcardShell';
import type { RatingIntervals } from '../../../components/RatingButtons';
import { AudioButton } from '../../../components/AudioButton';
import { HidePolishButton } from '../../../components/HidePolishButton';
import { HiddenPolishPlaceholder } from '../../../components/HiddenPolishPlaceholder';
import type { DrillableForm, Verb } from '../../../types/conjugation';
import type { TranslationDirection } from '../../../types/common';
import {
  getQuestionDisplay,
  getAnswerDisplay,
  getTenseLabel,
  getAspectLabel,
  getVerbClassLabel,
} from '../../../lib/conjugationUtils';
import { alpha } from '../../../lib/theme';
import { VerbConjugationTooltip } from '../../../components/VerbConjugationTooltip';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { useAppSettings } from '../../../contexts/AppSettingsContext';

export type ConjugationRatingIntervals = RatingIntervals;

interface ConjugationFlashcardProps {
  form: DrillableForm;
  direction: TranslationDirection;
  aspectPairVerb?: Verb;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: ConjugationRatingIntervals;
  reassessIntervals?: ConjugationRatingIntervals;
  canEdit?: boolean;
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onReassess?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

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

const InfinitiveLabel = styled(Box)(({ theme }) => ({
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
  backgroundColor: alpha(theme.palette.secondary.main, 0.15),
  color: theme.palette.secondary.dark,
  fontWeight: 500,
}));

const AspectChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.consonants.main, 0.15),
  color: theme.palette.consonants.main,
  fontWeight: 500,
}));

const GenderChip = styled(Chip)<{ $gender: 'Masculine' | 'Feminine' | 'Neuter' }>(({
  theme,
  $gender,
}) => {
  const genderKey = $gender.toLowerCase() as 'masculine' | 'feminine' | 'neuter';
  return {
    backgroundColor: alpha(theme.palette.gender[genderKey].main, 0.15),
    color: theme.palette.gender[genderKey].main,
  };
});

const VerbClassChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.neutral.main, 0.15),
  color: theme.palette.neutral.dark,
}));

const AspectPairBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.text.primary, 0.03),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${alpha(theme.palette.info.main, 0.5)}`,
}));

export function ConjugationFlashcard({
  form,
  direction,
  aspectPairVerb,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  reassessIntervals,
  canEdit = false,
  onRate,
  onReassess,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onDelete,
}: ConjugationFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { settings } = useAppSettings();
  const hidePolish = settings.hidePolishText;

  const isPolishToEnglish = direction === 'pl-to-en';

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: form.form.audioUrl,
    cardId: form.fullFormKey,
    autoPlayOnMount: isPolishToEnglish,
    autoPlayOnReveal: !isPolishToEnglish,
    revealed,
  });

  const questionDisplay = getQuestionDisplay(form, direction);
  const answerData = getAnswerDisplay(form, direction);

  const aspectPairForm = aspectPairVerb
    ? getCorrespondingAspectPairForm(form, aspectPairVerb)
    : null;

  const headerActions = (
    <>
      {hasAudio && <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />}
      {hasAudio && <HidePolishButton />}
    </>
  );

  const question = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {!isPolishToEnglish && (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <TenseChip label={getTenseLabel(form.tense)} size="small" />
          {form.person === '2nd' && form.number === 'Plural' && (
            <PluralChip label="⊕ Plural" size="small" />
          )}
          {form.gender && (
            <GenderChip
              $gender={form.gender}
              label={`${form.gender === 'Masculine' ? '♂' : form.gender === 'Feminine' ? '♀' : '○'} ${form.gender}`}
              size="small"
            />
          )}
        </Stack>
      )}

      {isPolishToEnglish && hidePolish ? (
        <HiddenPolishPlaceholder />
      ) : (
        <QuestionText variant="h4" color="text.primary">
          {isPolishToEnglish ? (
            <VerbConjugationTooltip verb={form.verb} tense={form.tense}>
              {questionDisplay}
            </VerbConjugationTooltip>
          ) : (
            questionDisplay
          )}
        </QuestionText>
      )}

      {isPolishToEnglish && !hidePolish && (
        <InfinitiveLabel>
          <VerbConjugationTooltip verb={form.verb} tense={form.tense} />
        </InfinitiveLabel>
      )}
    </Box>
  );

  const answer = (
    <>
      {!isPolishToEnglish && hidePolish ? (
        <HiddenPolishPlaceholder />
      ) : (
        <AnswerText variant="h4" color="text.primary">
          {!isPolishToEnglish ? (
            <VerbConjugationTooltip verb={form.verb} tense={form.tense}>
              {answerData.primary}
            </VerbConjugationTooltip>
          ) : (
            answerData.primary
          )}
        </AnswerText>
      )}
      {answerData.alternatives &&
        answerData.alternatives.length > 0 &&
        !(!isPolishToEnglish && hidePolish) && (
          <AlternativesText>Also: {answerData.alternatives.join(', ')}</AlternativesText>
        )}

      {!isPolishToEnglish && !hidePolish && (
        <InfinitiveLabel>
          <VerbConjugationTooltip verb={form.verb} tense={form.tense} />
        </InfinitiveLabel>
      )}

      <Stack direction="row" spacing={0.75} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
        <AspectChip label={getAspectLabel(form.verb.aspect)} size="small" />
        <VerbClassChip label={getVerbClassLabel(form.verb.verbClass)} size="small" />
        {form.verb.isReflexive && <MetaChip label="↩ Reflexive" size="small" />}
        {isPolishToEnglish && form.gender && (
          <GenderChip
            $gender={form.gender}
            label={`${form.gender === 'Masculine' ? '♂' : form.gender === 'Feminine' ? '♀' : '○'} ${form.gender}`}
            size="small"
          />
        )}
      </Stack>

      {aspectPairForm && aspectPairVerb && !hidePolish && (
        <AspectPairBox>
          <Typography variant="body2" color="text.secondary">
            {aspectPairVerb.aspect}: <strong>{aspectPairForm}</strong>
          </Typography>
        </AspectPairBox>
      )}
    </>
  );

  return (
    <FlashcardShell
      revealed={revealed}
      practiceMode={practiceMode}
      isViewingHistory={isViewingHistory}
      canGoBack={canGoBack}
      intervals={intervals}
      reassessIntervals={reassessIntervals}
      canEdit={canEdit}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
      onReassess={onReassess}
      onNext={onNext}
      onGoBack={onGoBack}
      onContinue={onContinue}
      onEdit={onEdit}
      onDelete={onDelete}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

function getCorrespondingAspectPairForm(form: DrillableForm, aspectPairVerb: Verb): string | null {
  const { tense, formKey } = form;

  if (tense === 'present') {
    if (aspectPairVerb.aspect === 'Perfective' && aspectPairVerb.conjugations.future) {
      const futureForm =
        aspectPairVerb.conjugations.future[
          formKey as keyof typeof aspectPairVerb.conjugations.future
        ];
      return futureForm?.pl ?? null;
    }
  }

  if (tense === 'future') {
    if (aspectPairVerb.aspect === 'Imperfective' && aspectPairVerb.conjugations.present) {
      const presentForm =
        aspectPairVerb.conjugations.present[
          formKey as keyof typeof aspectPairVerb.conjugations.present
        ];
      return presentForm?.pl ?? null;
    } else if (aspectPairVerb.conjugations.future) {
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

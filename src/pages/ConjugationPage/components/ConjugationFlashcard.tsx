import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell, type ReviewFlashcardProps } from '../../../components/FlashcardShell';
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
import { FlashcardMetaChip, AccentNoteBox } from '../../../components/flashcardStyles';

interface ConjugationFlashcardProps extends ReviewFlashcardProps {
  form: DrillableForm;
  direction: TranslationDirection;
  aspectPairVerb?: Verb;
  canEdit?: boolean;
  isAdmin?: boolean;
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

type Gender = 'Masculine' | 'Feminine' | 'Neuter';
const GENDER_SYMBOLS: Record<Gender, string> = { Masculine: '♂', Feminine: '♀', Neuter: '○' };

function GenderBadge({ gender }: { gender: Gender }) {
  return <GenderChip $gender={gender} label={`${GENDER_SYMBOLS[gender]} ${gender}`} size="small" />;
}

interface SideTextProps {
  form: DrillableForm;
  text: string;
  isPolish: boolean;
  polishShown: boolean;
  Text: typeof QuestionText | typeof AnswerText;
}

/** One side of the card; the Polish side gets the conjugation tooltip and respects "hide Polish". */
function SideText({ form, text, isPolish, polishShown, Text }: SideTextProps) {
  if (isPolish && !polishShown) return <HiddenPolishPlaceholder />;
  return (
    <Text variant="h4" color="text.primary">
      {isPolish ? (
        <VerbConjugationTooltip verb={form.verb} tense={form.tense}>
          {text}
        </VerbConjugationTooltip>
      ) : (
        text
      )}
    </Text>
  );
}

function InfinitiveLine({ form }: { form: DrillableForm }) {
  return (
    <InfinitiveLabel>
      <VerbConjugationTooltip verb={form.verb} tense={form.tense} />
    </InfinitiveLabel>
  );
}

function PromptChips({ form }: { form: DrillableForm }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      <TenseChip label={getTenseLabel(form.tense)} size="small" />
      {form.person === '2nd' && form.number === 'Plural' && (
        <PluralChip label="⊕ Plural" size="small" />
      )}
      {form.gender && <GenderBadge gender={form.gender} />}
    </Stack>
  );
}

function VerbMetaChips({ form, showGender }: { form: DrillableForm; showGender: boolean }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
      <AspectChip label={getAspectLabel(form.verb.aspect)} size="small" />
      <VerbClassChip label={getVerbClassLabel(form.verb.verbClass)} size="small" />
      {form.verb.isReflexive && <FlashcardMetaChip label="↩ Reflexive" size="small" />}
      {showGender && form.gender && <GenderBadge gender={form.gender} />}
    </Stack>
  );
}

export function ConjugationFlashcard({
  form,
  direction,
  aspectPairVerb,
  isViewingHistory = false,
  canEdit = false,
  onDelete,
  ...shellProps
}: ConjugationFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { settings } = useAppSettings();
  const polishShown = !settings.hidePolishText || revealed;

  const isPolishToEnglish = direction === 'pl-to-en';

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: form.form.audioUrl,
    cardId: form.fullFormKey,
    autoPlayOnMount: isPolishToEnglish,
    autoPlayOnReveal: !isPolishToEnglish,
    revealed,
  });

  const answerData = getAnswerDisplay(form, direction);
  const alternatives = answerData.alternatives ?? [];
  const aspectPairForm = aspectPairVerb && getCorrespondingAspectPairForm(form, aspectPairVerb);

  const headerActions = hasAudio && (
    <>
      <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />
      <HidePolishButton />
    </>
  );

  const question = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {!isPolishToEnglish && <PromptChips form={form} />}
      <SideText
        form={form}
        text={getQuestionDisplay(form, direction)}
        isPolish={isPolishToEnglish}
        polishShown={polishShown}
        Text={QuestionText}
      />
      {isPolishToEnglish && polishShown && <InfinitiveLine form={form} />}
    </Box>
  );

  const answer = (
    <>
      <SideText
        form={form}
        text={answerData.primary}
        isPolish={!isPolishToEnglish}
        polishShown={polishShown}
        Text={AnswerText}
      />
      {alternatives.length > 0 && (isPolishToEnglish || polishShown) && (
        <AlternativesText>Also: {alternatives.join(', ')}</AlternativesText>
      )}
      {!isPolishToEnglish && polishShown && <InfinitiveLine form={form} />}

      <VerbMetaChips form={form} showGender={isPolishToEnglish} />

      {aspectPairForm && polishShown && (
        <AccentNoteBox $accent="info">
          <Typography variant="body2" color="text.secondary">
            {aspectPairVerb.aspect}: <strong>{aspectPairForm}</strong>
          </Typography>
        </AccentNoteBox>
      )}
    </>
  );

  return (
    <FlashcardShell
      {...shellProps}
      revealed={revealed}
      isViewingHistory={isViewingHistory}
      canEdit={canEdit}
      onReveal={() => setRevealed(true)}
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

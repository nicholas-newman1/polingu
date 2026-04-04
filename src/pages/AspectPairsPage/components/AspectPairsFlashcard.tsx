import { useState, useRef, useCallback, useEffect } from 'react';
import type { Grade } from 'ts-fsrs';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell } from '../../../components/FlashcardShell';
import type { RatingIntervals } from '../../../components/RatingButtons';
import { AudioButton } from '../../../components/AudioButton';
import type { AspectPairCard } from '../../../types/aspectPairs';
import type { Verb, Tense } from '../../../types/conjugation';
import { alpha } from '../../../lib/theme';
import { VerbConjugationTooltip } from '../../../components/VerbConjugationTooltip';
import { useAppSettings } from '../../../contexts/AppSettingsContext';

interface AspectPairsFlashcardProps {
  card: AspectPairCard;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: RatingIntervals;
  canEdit?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onUnlink?: () => void;
}

const DirectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

const QuestionText = styled(Typography)({
  fontWeight: 400,
  lineHeight: 1.4,
});

const AnswerText = styled(Typography)({
  fontWeight: 500,
});

const AspectChip = styled(Chip)<{ $aspect: 'Imperfective' | 'Perfective' }>(
  ({ theme, $aspect }) => ({
    backgroundColor:
      $aspect === 'Imperfective'
        ? alpha(theme.palette.info.main, 0.15)
        : alpha(theme.palette.success.main, 0.15),
    color: $aspect === 'Imperfective' ? theme.palette.info.main : theme.palette.success.main,
    fontWeight: 500,
  })
);

const PairBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.text.primary, 0.03),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.5)}`,
}));

const EnglishMeaningText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

const BiaspectualNote = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  fontStyle: 'italic',
  color: theme.palette.warning.main,
  fontSize: '0.875rem',
}));

function getDefaultTenseForVerb(verb: Verb): Tense {
  return verb.aspect === 'Perfective' ? 'future' : 'present';
}

export function AspectPairsFlashcard({
  card,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  canEdit = false,
  onRate,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onUnlink,
}: AspectPairsFlashcardProps) {
  const { settings: appSettings } = useAppSettings();
  const [revealed, setRevealed] = useState(isViewingHistory);
  const [showPerfectiveFirst] = useState(() => Math.random() < 0.5);
  const [playingAudio, setPlayingAudio] = useState<'front' | 'back' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoPlayedFrontRef = useRef(false);
  const hasAutoPlayedBackRef = useRef(false);

  const isBiaspectual = card.verb.id === card.pairVerb.id;

  const frontVerb = showPerfectiveFirst ? card.pairVerb : card.verb;
  const backVerb = showPerfectiveFirst ? card.verb : card.pairVerb;

  const frontAudioUrl = frontVerb.infinitiveAudioUrl;
  const backAudioUrl = backVerb.infinitiveAudioUrl;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingAudio(null);
    }
  }, []);

  const playAudio = useCallback(
    (url: string, which: 'front' | 'back') => {
      stopAudio();

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingAudio(which);

      audio.onended = () => setPlayingAudio(null);
      audio.onerror = () => setPlayingAudio(null);
      audio.play().catch(() => setPlayingAudio(null));
    },
    [stopAudio]
  );

  const toggleFrontAudio = useCallback(() => {
    if (!frontAudioUrl) return;
    if (playingAudio) {
      stopAudio();
    } else {
      playAudio(frontAudioUrl, 'front');
    }
  }, [playingAudio, stopAudio, playAudio, frontAudioUrl]);

  const toggleBackAudio = useCallback(() => {
    if (!backAudioUrl) return;
    if (playingAudio) {
      stopAudio();
    } else {
      playAudio(backAudioUrl, 'back');
    }
  }, [playingAudio, stopAudio, playAudio, backAudioUrl]);

  // Reset auto-play flags and stop audio when card changes
  useEffect(() => {
    hasAutoPlayedFrontRef.current = false;
    hasAutoPlayedBackRef.current = false;
    return () => stopAudio();
  }, [card.verb.id, card.pairVerb.id, stopAudio]);

  // Auto-play front verb audio when card opens
  useEffect(() => {
    if (!appSettings.autoPlayAudio || !frontAudioUrl || hasAutoPlayedFrontRef.current) return;

    hasAutoPlayedFrontRef.current = true;
    queueMicrotask(() => playAudio(frontAudioUrl, 'front'));
  }, [card.verb.id, card.pairVerb.id, frontAudioUrl, playAudio, appSettings.autoPlayAudio]);

  // Auto-play back verb audio when revealed (if not biaspectual)
  useEffect(() => {
    if (
      !appSettings.autoPlayAudio ||
      !backAudioUrl ||
      hasAutoPlayedBackRef.current ||
      isBiaspectual
    )
      return;

    if (revealed) {
      hasAutoPlayedBackRef.current = true;
      queueMicrotask(() => playAudio(backAudioUrl, 'back'));
    }
  }, [revealed, backAudioUrl, playAudio, isBiaspectual, appSettings.autoPlayAudio]);

  const header = <DirectionLabel>Aspect Pairs</DirectionLabel>;

  const headerActions = frontAudioUrl ? (
    <AudioButton isPlaying={playingAudio === 'front'} onToggle={toggleFrontAudio} />
  ) : undefined;

  const question = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <QuestionText variant="h4" color="text.primary">
        <VerbConjugationTooltip verb={frontVerb} tense={getDefaultTenseForVerb(frontVerb)} />
      </QuestionText>
    </Box>
  );

  const answer = (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <AspectChip $aspect={frontVerb.aspect} label={frontVerb.aspect} size="small" />
      </Stack>

      {isBiaspectual ? (
        <>
          <AnswerText variant="h5" color="text.primary">
            <VerbConjugationTooltip verb={frontVerb} tense={getDefaultTenseForVerb(frontVerb)} />
          </AnswerText>
          <BiaspectualNote>
            This verb is biaspectual — the same form is used for both perfective and imperfective.
          </BiaspectualNote>
        </>
      ) : (
        <PairBox>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {backVerb.aspect}:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnswerText variant="h5" color="text.primary">
              <VerbConjugationTooltip verb={backVerb} tense={getDefaultTenseForVerb(backVerb)} />
            </AnswerText>
            {backAudioUrl && (
              <AudioButton isPlaying={playingAudio === 'back'} onToggle={toggleBackAudio} />
            )}
          </Box>
        </PairBox>
      )}

      <EnglishMeaningText variant="body1">{frontVerb.infinitiveEn}</EnglishMeaningText>
    </>
  );

  return (
    <FlashcardShell
      revealed={revealed}
      practiceMode={practiceMode}
      isViewingHistory={isViewingHistory}
      canGoBack={canGoBack}
      intervals={intervals}
      canEdit={canEdit}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
      onNext={onNext}
      onGoBack={onGoBack}
      onContinue={onContinue}
      onEdit={onEdit}
      onDelete={onUnlink}
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

export type { RatingIntervals };

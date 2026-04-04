import { useState, useMemo } from 'react';
import type { Grade } from 'ts-fsrs';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell } from '../../../components/FlashcardShell';
import type { RatingIntervals } from '../../../components/RatingButtons';
import { AudioButton } from '../../../components/AudioButton';
import type { DeclensionCard } from '../../../types';
import { renderTappableText } from '../../../lib/renderTappableText';
import { useTranslationContext } from '../../../hooks/useTranslationContext';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';

export type DeclensionRatingIntervals = RatingIntervals;

interface DeclensionFlashcardProps {
  card: DeclensionCard;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: DeclensionRatingIntervals;
  canEdit?: boolean;
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

const QuestionText = styled(Box)(({ theme }) => ({
  fontWeight: 300,
  lineHeight: 1.5,
  flex: 1,
  ...theme.typography.h5,
  color: theme.palette.text.primary,
}));

const AnswerText = styled(Box)(({ theme }) => ({
  fontWeight: 500,
  ...theme.typography.h4,
  color: theme.palette.text.primary,
}));

const MetaChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.secondary,
}));

const HintText = styled(Typography)({
  fontStyle: 'italic',
});

const CustomLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

export function DeclensionFlashcard({
  card,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  canEdit = false,
  isAdmin = false,
  onRate,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onUpdateTranslation,
}: DeclensionFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { handleDailyLimitReached } = useTranslationContext();

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: card.audioUrl,
    cardId: card.id,
    autoPlayOnReveal: true,
    revealed,
  });

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

  const header = card.isCustom ? <CustomLabel>Custom</CustomLabel> : undefined;

  const headerActions = hasAudio ? (
    <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />
  ) : undefined;

  const question = (
    <QuestionText>{renderTappableText(card.front, tappableTextOptions)}</QuestionText>
  );

  const answer = (
    <>
      <AnswerText sx={{ mb: 2 }}>
        {renderTappableText(card.back, tappableTextOptions, card.declined)}
      </AnswerText>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <MetaChip label={card.case} size="small" />
        <MetaChip label={card.gender} size="small" />
        <MetaChip label={card.number} size="small" />
      </Stack>

      {card.hint && (
        <HintText variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          💡 {card.hint}
        </HintText>
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
      canEdit={canEdit}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
      onNext={onNext}
      onGoBack={onGoBack}
      onContinue={onContinue}
      onEdit={onEdit}
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

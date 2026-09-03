import { useState, useMemo } from 'react';
import type { Grade } from 'ts-fsrs';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell } from '../../../components/FlashcardShell';
import type { RatingIntervals } from '../../../components/RatingButtons';
import { AudioButton } from '../../../components/AudioButton';
import { HidePolishButton } from '../../../components/HidePolishButton';
import { HiddenPolishPlaceholder } from '../../../components/HiddenPolishPlaceholder';
import type { DeclensionCard } from '../../../types';
import { renderTappableText } from '../../../lib/renderTappableText';
import { useTranslationContext } from '../../../hooks/useTranslationContext';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { useAppSettings } from '../../../contexts/AppSettingsContext';

export type DeclensionRatingIntervals = RatingIntervals;

interface DeclensionFlashcardProps {
  card: DeclensionCard;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: DeclensionRatingIntervals;
  reassessIntervals?: DeclensionRatingIntervals;
  canEdit?: boolean;
  onRate?: (rating: Grade) => void;
  onReassess?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  reassessIntervals,
  canEdit = false,
  onRate,
  onReassess,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onDelete,
  onUpdateTranslation,
}: DeclensionFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { handleDailyLimitReached } = useTranslationContext();
  const { settings } = useAppSettings();
  const hidePolish = settings.hidePolishText;

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
    }),
    [handleDailyLimitReached, card.back, card.translations, declensionCardId, onUpdateTranslation]
  );

  const header = card.isCustom ? <CustomLabel>Custom</CustomLabel> : undefined;

  const headerActions = (
    <>
      {hasAudio && <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />}
      {hasAudio && <HidePolishButton />}
    </>
  );

  const question = (
    <QuestionText>{renderTappableText(card.front, tappableTextOptions)}</QuestionText>
  );

  const answer = (
    <>
      <AnswerText sx={{ mb: 2 }}>
        {hidePolish && !revealed ? (
          <HiddenPolishPlaceholder />
        ) : (
          renderTappableText(card.back, tappableTextOptions, card.declined)
        )}
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
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

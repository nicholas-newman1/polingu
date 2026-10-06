import { useState, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell, type ReviewFlashcardProps } from '../../../components/FlashcardShell';
import { AudioButton } from '../../../components/AudioButton';
import { HidePolishButton } from '../../../components/HidePolishButton';
import { HiddenPolishPlaceholder } from '../../../components/HiddenPolishPlaceholder';
import type { DeclensionCard } from '../../../types';
import { renderTappableText } from '../../../lib/renderTappableText';
import { useTranslationContext } from '../../../hooks/useTranslationContext';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { FlashcardMetaChip, FlashcardHint } from '../../../components/flashcardStyles';

interface DeclensionFlashcardProps extends ReviewFlashcardProps {
  card: DeclensionCard;
  canEdit?: boolean;
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

const CustomLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}));

export function DeclensionFlashcard({
  card,
  isViewingHistory = false,
  canEdit = false,
  onDelete,
  onUpdateTranslation,
  ...shellProps
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
        <FlashcardMetaChip label={card.case} size="small" />
        <FlashcardMetaChip label={card.gender} size="small" />
        <FlashcardMetaChip label={card.number} size="small" />
      </Stack>

      {card.hint && (
        <FlashcardHint variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          💡 {card.hint}
        </FlashcardHint>
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
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

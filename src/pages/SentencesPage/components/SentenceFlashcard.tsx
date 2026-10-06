import { useState, useMemo } from 'react';
import { Box, Chip, Stack } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell, type ReviewFlashcardProps } from '../../../components/FlashcardShell';
import { AudioButton } from '../../../components/AudioButton';
import { HidePolishButton } from '../../../components/HidePolishButton';
import { HiddenPolishPlaceholder } from '../../../components/HiddenPolishPlaceholder';
import { renderTappableText } from '../../../lib/renderTappableText';
import type { Sentence, CEFRLevel } from '../../../types/sentences';
import type { TranslationDirection } from '../../../types/common';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { useAppSettings } from '../../../contexts/AppSettingsContext';

interface SentenceFlashcardProps extends ReviewFlashcardProps {
  sentence: Sentence;
  direction: TranslationDirection;
  canEdit?: boolean;
  onDelete?: () => void;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
}

const LevelChip = styled(Chip)<{ $level: CEFRLevel }>(({ theme, $level }) => ({
  backgroundColor: theme.palette.levels[$level],
  color: theme.palette.common.white,
  fontWeight: 600,
  fontSize: '0.7rem',
  height: 22,
}));

const TagChip = styled(Chip)(({ theme }) => ({
  height: 22,
  fontSize: '0.7rem',
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));

const SentenceText = styled(Box)(({ theme }) => ({
  fontSize: '1.35rem',
  lineHeight: 1.6,
  fontWeight: 400,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.15rem',
  },
}));

const AnswerTextBox = styled(Box)(({ theme }) => ({
  fontSize: '1.25rem',
  lineHeight: 1.5,
  fontWeight: 500,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.1rem',
  },
}));

export function SentenceFlashcard({
  sentence,
  direction,
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
  onDailyLimitReached,
  onUpdateTranslation,
}: SentenceFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { settings } = useAppSettings();
  const hidePolish = settings.hidePolishText;

  const isPolishToEnglish = direction === 'pl-to-en';

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: sentence.audioUrl,
    cardId: sentence.id,
    autoPlayOnMount: isPolishToEnglish,
    autoPlayOnReveal: !isPolishToEnglish,
    revealed,
  });

  const tappableTextOptions = useMemo(
    () => ({
      translations: sentence.translations,
      sentenceId: sentence.id,
      onDailyLimitReached,
      onUpdateTranslation,
      sentenceContext: sentence.polish,
    }),
    [sentence.translations, sentence.id, sentence.polish, onDailyLimitReached, onUpdateTranslation]
  );

  const questionContent =
    isPolishToEnglish && hidePolish && !revealed ? (
      <HiddenPolishPlaceholder />
    ) : isPolishToEnglish ? (
      renderTappableText(sentence.polish, tappableTextOptions)
    ) : (
      sentence.english
    );

  const answerContent =
    !isPolishToEnglish && hidePolish && !revealed ? (
      <HiddenPolishPlaceholder />
    ) : isPolishToEnglish ? (
      sentence.english
    ) : (
      renderTappableText(sentence.polish, tappableTextOptions)
    );

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this sentence?')) {
      onDelete?.();
    }
  };

  const header = <LevelChip $level={sentence.level} label={sentence.level} />;

  const headerActions = (
    <>
      {hasAudio && <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />}
      {hasAudio && <HidePolishButton />}
    </>
  );

  const tags = sentence.tags.length > 0 && (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
      {sentence.tags.map((tag) => (
        <TagChip key={tag} label={tag} size="small" />
      ))}
    </Stack>
  );

  const question = (
    <>
      {!isPolishToEnglish && tags}
      <SentenceText sx={{ mb: 2 }}>{questionContent}</SentenceText>
    </>
  );

  const answer = (
    <>
      {isPolishToEnglish && tags}
      <AnswerTextBox sx={{ mb: 2 }}>{answerContent}</AnswerTextBox>
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
      maxWidth={520}
      canEdit={canEdit}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
      onReassess={onReassess}
      onNext={onNext}
      onGoBack={onGoBack}
      onContinue={onContinue}
      onEdit={onEdit}
      onDelete={handleDelete}
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

import { useState } from 'react';
import type { Grade } from 'ts-fsrs';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '../../../lib/styled';
import { FlashcardShell } from '../../../components/FlashcardShell';
import type { RatingIntervals } from '../../../components/RatingButtons';
import { AudioButton } from '../../../components/AudioButton';
import type { VocabularyWord } from '../../../types/vocabulary';
import type { TranslationDirection } from '../../../types/common';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';

interface VocabularyFlashcardProps {
  word: VocabularyWord;
  direction: TranslationDirection;
  practiceMode?: boolean;
  isViewingHistory?: boolean;
  canGoBack?: boolean;
  intervals?: RatingIntervals;
  isAdmin?: boolean;
  onRate?: (rating: Grade) => void;
  onNext?: () => void;
  onGoBack?: () => void;
  onContinue?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const CustomLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
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

function formatPartOfSpeech(pos: string): string {
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

export function VocabularyFlashcard({
  word,
  direction,
  practiceMode = false,
  isViewingHistory = false,
  canGoBack = false,
  intervals,
  isAdmin = false,
  onRate,
  onNext,
  onGoBack,
  onContinue,
  onEdit,
  onDelete,
}: VocabularyFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);

  const isPolishToEnglish = direction === 'pl-to-en';

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: word.audioUrl,
    cardId: word.id,
    autoPlayOnMount: isPolishToEnglish,
    autoPlayOnReveal: !isPolishToEnglish,
    revealed,
  });

  const questionWord = isPolishToEnglish ? word.polish : word.english;
  const answerWord = isPolishToEnglish ? word.english : word.polish;
  const isCustomWord = word.isCustom === true;
  const canEditOrDelete = isCustomWord || isAdmin;

  const header = isCustomWord ? <CustomLabel>Custom</CustomLabel> : undefined;

  const headerActions = hasAudio ? (
    <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />
  ) : undefined;

  const question = (
    <>
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
    </>
  );

  const answer = (
    <>
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
    </>
  );

  return (
    <FlashcardShell
      revealed={revealed}
      practiceMode={practiceMode}
      isViewingHistory={isViewingHistory}
      canGoBack={canGoBack}
      intervals={intervals}
      canEdit={canEditOrDelete}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
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

// Re-export RatingIntervals for backwards compatibility
export type { RatingIntervals };

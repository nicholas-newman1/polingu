import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { styled } from '../../../lib/styled';
import { FlashcardShell, type ReviewFlashcardProps } from '../../../components/FlashcardShell';
import { AudioButton } from '../../../components/AudioButton';
import { HidePolishButton } from '../../../components/HidePolishButton';
import { HiddenPolishPlaceholder } from '../../../components/HiddenPolishPlaceholder';
import type { ExampleSentence, VocabularyWord } from '../../../types/vocabulary';
import capitalize from '../../../lib/utils/capitalize';
import type { TranslationDirection } from '../../../types/common';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { FlashcardMetaChip, FlashcardHint } from '../../../components/flashcardStyles';

interface VocabularyFlashcardProps extends ReviewFlashcardProps {
  word: VocabularyWord;
  direction: TranslationDirection;
  isAdmin?: boolean;
  onDelete?: () => void;
  onGenerateSentences?: () => void;
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

const GenerateSentencesButton = styled(Button)(({ theme }) => ({
  alignSelf: 'flex-start',
  marginTop: theme.spacing(1.5),
  marginBottom: theme.spacing(2),
  textTransform: 'none',
  fontSize: '0.8125rem',
}));

function WordText({
  text,
  hidden,
  Text,
}: {
  text: string;
  hidden: boolean;
  Text: typeof QuestionText | typeof AnswerText;
}) {
  if (hidden) {
    return (
      <Box sx={{ mb: 2 }}>
        <HiddenPolishPlaceholder />
      </Box>
    );
  }
  return (
    <Text variant="h4" color="text.primary" sx={{ mb: 2 }}>
      {text}
    </Text>
  );
}

interface ExampleSentencesProps {
  examples: ExampleSentence[];
  isPolishToEnglish: boolean;
  revealed: boolean;
  animate: boolean;
}

function ExampleSentences({
  examples,
  isPolishToEnglish,
  revealed,
  animate,
}: ExampleSentencesProps) {
  return (
    <ExamplesList className={animate ? 'animate-fade-up' : undefined}>
      {examples.map((example, index) => (
        <ExampleItem key={index}>
          <Box>
            <ExampleNumber>{index + 1}.</ExampleNumber>
            <ExamplePrimary>{isPolishToEnglish ? example.polish : example.english}</ExamplePrimary>
          </Box>
          {revealed && (
            <ExampleTranslation variant="body2" color="text.disabled" className="animate-fade-up">
              {isPolishToEnglish ? example.english : example.polish}
            </ExampleTranslation>
          )}
        </ExampleItem>
      ))}
    </ExamplesList>
  );
}

function WordDetails({ word }: { word: VocabularyWord }) {
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {word.partOfSpeech && (
          <FlashcardMetaChip label={capitalize(word.partOfSpeech)} size="small" />
        )}
        {word.gender && <FlashcardMetaChip label={word.gender} size="small" />}
      </Stack>

      {word.notes && (
        <FlashcardHint variant="body2" color="text.disabled">
          💡 {word.notes}
        </FlashcardHint>
      )}
    </>
  );
}

export function VocabularyFlashcard({
  word,
  direction,
  isViewingHistory = false,
  isAdmin = false,
  onDelete,
  onGenerateSentences,
  ...shellProps
}: VocabularyFlashcardProps) {
  const [revealed, setRevealed] = useState(isViewingHistory);
  const { settings } = useAppSettings();
  const hidePolish = settings.hidePolishText;

  const isPolishToEnglish = direction === 'pl-to-en';

  const { isPlaying, toggleAudio, hasAudio } = useAudioPlayer({
    audioUrl: word.audioUrl,
    cardId: word.id,
    autoPlayOnMount: isPolishToEnglish,
    autoPlayOnReveal: !isPolishToEnglish,
    revealed,
  });

  const isCustomWord = word.isCustom === true;
  const header = isCustomWord ? <CustomLabel>Custom</CustomLabel> : undefined;

  const headerActions = hasAudio && (
    <>
      <AudioButton isPlaying={isPlaying} onToggle={toggleAudio} />
      <HidePolishButton />
    </>
  );

  const polishHidden = hidePolish && !revealed;
  const examples = word.examples ?? [];

  const generateSentencesButton = examples.length === 0 && onGenerateSentences && (
    <GenerateSentencesButton
      size="small"
      variant="contained"
      onClick={onGenerateSentences}
      startIcon={<AutoAwesomeIcon fontSize="small" />}
    >
      Generate sentences
    </GenerateSentencesButton>
  );

  const question = (
    <>
      <WordText
        text={isPolishToEnglish ? word.polish : word.english}
        hidden={isPolishToEnglish && polishHidden}
        Text={QuestionText}
      />
      {examples.length > 0 && !polishHidden && (
        <ExampleSentences
          examples={examples}
          isPolishToEnglish={isPolishToEnglish}
          revealed={revealed}
          animate={hidePolish}
        />
      )}
      {!revealed && generateSentencesButton}
    </>
  );

  const answer = (
    <>
      <WordText
        text={isPolishToEnglish ? word.english : word.polish}
        hidden={!isPolishToEnglish && polishHidden}
        Text={AnswerText}
      />
      <WordDetails word={word} />
      {generateSentencesButton}
    </>
  );

  return (
    <FlashcardShell
      {...shellProps}
      revealed={revealed}
      isViewingHistory={isViewingHistory}
      canEdit={isCustomWord || isAdmin}
      onReveal={() => setRevealed(true)}
      onDelete={onDelete}
      header={header}
      headerActions={headerActions}
      question={question}
      answer={answer}
    />
  );
}

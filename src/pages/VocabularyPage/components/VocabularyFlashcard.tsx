import { useId, useState } from 'react';
import { Box, Button, Collapse, Stack, Typography, useMediaQuery } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
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

const ExamplesToggle = styled(Button)(({ theme }) => ({
  justifyContent: 'flex-start',
  gap: theme.spacing(1),
  minHeight: 44,
  padding: theme.spacing(1, 1.5),
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.text.primary, 0.02),
  color: theme.palette.text.secondary,
  transition: theme.transitions.create(['background-color', 'border-color', 'color']),
  '&:hover, &[aria-expanded="true"]': {
    backgroundColor: alpha(theme.palette.text.primary, 0.05),
    borderColor: alpha(theme.palette.text.primary, 0.18),
    color: theme.palette.text.secondary,
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.text.secondary}`,
    outlineOffset: 3,
  },
  '& .examples-chevron': {
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', { duration: 220 }),
  },
  '&[aria-expanded="true"] .examples-chevron': {
    transform: 'rotate(180deg)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '& .examples-chevron': { transition: 'none' },
  },
}));

const ExamplesList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  margin: theme.spacing(1.5, 0, 0, 1.5),
  paddingLeft: theme.spacing(1.5),
  borderLeft: `2px solid ${theme.palette.divider}`,
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
}

function ExampleSentences({ examples, isPolishToEnglish, revealed }: ExampleSentencesProps) {
  const [expanded, setExpanded] = useState(false);
  const sectionId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <Box>
      <ExamplesToggle
        id={`${sectionId}-toggle`}
        type="button"
        fullWidth
        aria-expanded={expanded}
        aria-controls={sectionId}
        onClick={() => setExpanded((value) => !value)}
      >
        <FormatQuoteRoundedIcon fontSize="small" />
        Example sentences
        <ExpandMoreRoundedIcon className="examples-chevron" fontSize="small" />
      </ExamplesToggle>
      <Collapse
        in={expanded}
        timeout={reducedMotion ? 0 : 220}
        id={sectionId}
        role="region"
        aria-labelledby={`${sectionId}-toggle`}
      >
        <ExamplesList>
          {examples.map((example, index) => (
            <ExampleItem key={example.id ?? index}>
              <Box>
                <ExampleNumber>{index + 1}.</ExampleNumber>
                <ExamplePrimary>
                  {isPolishToEnglish ? example.polish : example.english}
                </ExamplePrimary>
              </Box>
              {revealed && (
                <ExampleTranslation
                  variant="body2"
                  color="text.disabled"
                  className="animate-fade-up"
                >
                  {isPolishToEnglish ? example.english : example.polish}
                </ExampleTranslation>
              )}
            </ExampleItem>
          ))}
        </ExamplesList>
      </Collapse>
    </Box>
  );
}

function WordDetails({ word }: { word: VocabularyWord }) {
  return (
    <>
      <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
        {word.partOfSpeech && (
          <FlashcardMetaChip label={capitalize(word.partOfSpeech)} size="small" />
        )}
        {word.gender && <FlashcardMetaChip label={word.gender} size="small" />}
      </Stack>

      {word.notes && (
        <FlashcardHint variant="body2" color="text.disabled" sx={{ mb: 2 }}>
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

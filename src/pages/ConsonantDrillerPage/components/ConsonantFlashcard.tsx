import { useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
import type { ConsonantCard, ConsonantType, ConsonantWord } from '../../../types/consonants';
import { getExampleWordsForConsonant } from '../../../data/consonants';
import { FlashcardSurface, FlashcardWrapper } from '../../../components/flashcardStyles';

interface ConsonantFlashcardProps {
  card: ConsonantCard;
  onNext: () => void;
}

const HeaderLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: theme.spacing(1),
}));

const ConsonantDisplay = styled(Typography)(({ theme }) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontWeight: 600,
  fontSize: '4rem',
  color: theme.palette.text.primary,
  textAlign: 'center',
  padding: theme.spacing(4, 0),
}));

const WordDisplay = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  fontSize: '2.5rem',
  color: theme.palette.text.primary,
  textAlign: 'center',
  padding: theme.spacing(2, 0),
}));

const TranslationText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textAlign: 'center',
  marginBottom: theme.spacing(2),
}));

const ButtonsRow = styled(Stack)(({ theme }) => ({
  marginTop: 'auto',
  gap: theme.spacing(2),
}));

const HardButton = styled(Button)(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.palette.error.main,
  color: theme.palette.common.white,
  fontWeight: 600,
  fontSize: '1.1rem',
  padding: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
  },
}));

const SoftButton = styled(Button)(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.palette.info.main,
  color: theme.palette.common.white,
  fontWeight: 600,
  fontSize: '1.1rem',
  padding: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: theme.palette.info.dark,
  },
}));

const NextButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.text.primary,
  color: theme.palette.background.default,
  fontWeight: 600,
  fontSize: '1rem',
  padding: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  },
}));

const ResultBox = styled(Box)<{ $correct: boolean }>(({ theme, $correct }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(2),
  backgroundColor: $correct
    ? alpha(theme.palette.success.main, 0.15)
    : alpha(theme.palette.error.main, 0.15),
  color: $correct ? theme.palette.success.main : theme.palette.error.main,
}));

const PairBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: alpha(theme.palette.consonants.main, 0.1),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${theme.palette.consonants.main}`,
}));

const ExampleWord = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0.5, 0),
  '& .word': {
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 500,
  },
  '& .translation': {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
}));

const GenderChip = styled(Chip)<{ $gender: string }>(({ theme, $gender }) => {
  const colorMap: Record<string, string> = {
    masculine: theme.palette.info.main,
    feminine: theme.palette.error.main,
    neuter: theme.palette.warning.main,
  };
  return {
    backgroundColor: alpha(colorMap[$gender] || theme.palette.grey[500], 0.15),
    color: colorMap[$gender] || theme.palette.grey[500],
    fontWeight: 500,
    fontSize: '0.7rem',
  };
});

function getConsonantLabel(type: ConsonantType): string {
  return type === 'hard' ? 'Hard' : 'Soft';
}

export function ConsonantFlashcard({ card, onNext }: ConsonantFlashcardProps) {
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<ConsonantType | null>(null);

  const isCorrect = selectedAnswer === card.correctAnswer;
  const isWordMode = card.type === 'word';

  const handleAnswer = (answer: ConsonantType) => {
    setSelectedAnswer(answer);
    setAnswered(true);
  };

  const handleNext = () => {
    setAnswered(false);
    setSelectedAnswer(null);
    onNext();
  };

  const exampleWords = isWordMode
    ? []
    : getExampleWordsForConsonant(
        card.correctAnswer === 'hard' ? card.pair.hard : card.pair.soft,
        3
      );

  return (
    <FlashcardWrapper $maxWidth={420} className="animate-fade-up">
      <FlashcardSurface $accent="consonants">
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <HeaderLabel>
            {isWordMode ? 'Word Mode' : 'Consonant Mode'} · Is this hard or soft?
          </HeaderLabel>

          {isWordMode && card.word ? (
            <>
              <WordDisplay>{card.word.word}</WordDisplay>
              {!answered && (
                <TranslationText variant="body1">{card.word.translation}</TranslationText>
              )}
              {!answered && (
                <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                  <GenderChip $gender={card.word.gender} label={card.word.gender} size="small" />
                  <Chip label={card.word.number} size="small" variant="outlined" />
                </Stack>
              )}
            </>
          ) : (
            <ConsonantDisplay>{card.consonant}</ConsonantDisplay>
          )}

          {answered && (
            <Box className="animate-fade-up">
              <ResultBox $correct={isCorrect}>
                {isCorrect ? (
                  <>
                    <CheckCircleIcon />
                    <Typography fontWeight={600}>Correct!</Typography>
                  </>
                ) : (
                  <>
                    <CancelIcon />
                    <Typography fontWeight={600}>
                      Wrong — it's {getConsonantLabel(card.correctAnswer)}
                    </Typography>
                  </>
                )}
              </ResultBox>

              <PairBox>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Consonant pair:
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                      Hard
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                      }}
                    >
                      {card.pair.hasHard ? card.pair.hard : '—'}
                    </Typography>
                  </Box>
                  <Typography color="text.disabled" sx={{ fontSize: '1.5rem' }}>
                    ↔
                  </Typography>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                      Soft
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                      }}
                    >
                      {card.pair.soft}
                    </Typography>
                  </Box>
                </Stack>

                {isWordMode && card.word && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">
                      {card.word.word} — {card.word.translation}
                    </Typography>
                    {card.word.softenedForm && (
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          color: 'info.main',
                        }}
                      >
                        → {card.word.softenedForm}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          ({card.word.softenedTranslation})
                        </Typography>
                      </Typography>
                    )}
                    {card.word.hardenedForm && (
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          color: 'warning.main',
                        }}
                      >
                        ← {card.word.hardenedForm}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          ({card.word.hardenedTranslation})
                        </Typography>
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      The consonant "
                      {card.correctAnswer === 'hard' ? card.pair.hard : card.pair.soft}" is{' '}
                      {card.correctAnswer}
                    </Typography>
                  </Box>
                )}

                {!isWordMode && exampleWords.length > 0 && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Example words:
                    </Typography>
                    {exampleWords.map((w: ConsonantWord, i: number) => (
                      <ExampleWord key={i}>
                        <Box>
                          {w.hardenedForm && (
                            <Box component="span" className="word" sx={{ color: 'warning.main' }}>
                              {w.hardenedForm}
                              {' → '}
                            </Box>
                          )}
                          <span className="word">{w.word}</span>
                          {w.softenedForm && (
                            <Box component="span" className="word" sx={{ color: 'info.main' }}>
                              {' → '}
                              {w.softenedForm}
                            </Box>
                          )}
                        </Box>
                        <span className="translation">{w.translation}</span>
                      </ExampleWord>
                    ))}
                  </Box>
                )}
              </PairBox>
            </Box>
          )}
        </Box>

        <ButtonsRow direction={answered ? 'column' : 'row'}>
          {answered ? (
            <NextButton fullWidth variant="contained" onClick={handleNext}>
              Next →
            </NextButton>
          ) : (
            <>
              <HardButton variant="contained" onClick={() => handleAnswer('hard')}>
                Hard
              </HardButton>
              <SoftButton variant="contained" onClick={() => handleAnswer('soft')}>
                Soft
              </SoftButton>
            </>
          )}
        </ButtonsRow>
      </FlashcardSurface>
    </FlashcardWrapper>
  );
}

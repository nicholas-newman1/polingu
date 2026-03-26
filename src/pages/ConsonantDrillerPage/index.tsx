import { useState, useMemo, useCallback } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { styled } from '../../lib/styled';
import { ConsonantFlashcard } from './components/ConsonantFlashcard';
import { CONSONANT_PAIRS, CONSONANT_WORDS } from '../../data/consonants';
import type { ConsonantCard, ConsonantDrillerMode, ConsonantPair } from '../../types/consonants';
import { balancedShuffle } from '../../lib/utils/shuffleArray';

const MainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

const ControlsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
  flexWrap: 'wrap',
}));

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  '& .MuiToggleButton-root': {
    padding: theme.spacing(1, 2),
    fontWeight: 500,
    '&.Mui-selected': {
      backgroundColor: theme.palette.consonants.main,
      color: theme.palette.common.white,
      '&:hover': {
        backgroundColor: theme.palette.consonants.dark,
      },
    },
  },
}));

const RestartButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.text.primary,
  },
}));

const FinishedBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(2),
  maxWidth: 400,
}));

function generateConsonantCards(): ConsonantCard[] {
  const cards: ConsonantCard[] = [];

  for (const pair of CONSONANT_PAIRS) {
    if (pair.hasHard && pair.hard) {
      cards.push({
        type: 'consonant',
        consonant: pair.hard,
        correctAnswer: 'hard',
        pair,
      });
    }

    cards.push({
      type: 'consonant',
      consonant: pair.soft,
      correctAnswer: 'soft',
      pair,
    });
  }

  return balancedShuffle(cards, (card) => card.correctAnswer, 2);
}

function generateWordCards(): ConsonantCard[] {
  const cards: ConsonantCard[] = CONSONANT_WORDS.map((word) => {
    const pair = CONSONANT_PAIRS.find(
      (p) => p.hard === word.consonant || p.soft === word.consonant
    );

    const fallbackPair: ConsonantPair = {
      hard: word.consonantType === 'hard' ? word.consonant : '',
      soft: word.consonantType === 'soft' ? word.consonant : '',
      hasHard: word.consonantType === 'hard',
    };

    return {
      type: 'word' as const,
      word,
      correctAnswer: word.consonantType,
      pair: pair || fallbackPair,
    };
  });

  return balancedShuffle(cards, (card) => card.correctAnswer, 2);
}

export function ConsonantDrillerPage() {
  const [mode, setMode] = useState<ConsonantDrillerMode>('consonant');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);

  const cards = useMemo(
    () => (mode === 'consonant' ? generateConsonantCards() : generateWordCards()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionKey forces reshuffle on restart
    [mode, sessionKey]
  );

  const currentCard = cards[currentIndex];
  const isFinished = currentIndex >= cards.length;

  const handleModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: ConsonantDrillerMode | null) => {
      if (newMode) {
        setMode(newMode);
        setCurrentIndex(0);
        setSessionKey((k) => k + 1);
      }
    },
    []
  );

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSessionKey((k) => k + 1);
  }, []);

  return (
    <>
      <ControlsRow>
        <StyledToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          aria-label="driller mode"
        >
          <ToggleButton value="consonant">Consonant</ToggleButton>
          <ToggleButton value="word">Word</ToggleButton>
        </StyledToggleButtonGroup>

        <RestartButton onClick={handleRestart} title="Restart">
          <RestartAltIcon />
        </RestartButton>
      </ControlsRow>

      <MainContent>
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ mb: { xs: 3, sm: 4 }, textAlign: 'center' }}
        >
          {isFinished
            ? `Completed all ${cards.length} cards`
            : `${currentIndex + 1} / ${cards.length}`}
        </Typography>

        {isFinished ? (
          <FinishedBox className="animate-fade-up">
            <Typography variant="h5" sx={{ mb: 2 }}>
              🎉 Session Complete!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              You've gone through all {cards.length} {mode === 'consonant' ? 'consonants' : 'words'}
              .
            </Typography>
            <Button
              variant="contained"
              onClick={handleRestart}
              sx={{
                backgroundColor: 'consonants.main',
                '&:hover': { backgroundColor: 'consonants.dark' },
              }}
            >
              Drill Again
            </Button>
          </FinishedBox>
        ) : currentCard ? (
          <ConsonantFlashcard
            key={`${sessionKey}-${currentIndex}`}
            card={currentCard}
            onNext={handleNext}
          />
        ) : null}
      </MainContent>
    </>
  );
}

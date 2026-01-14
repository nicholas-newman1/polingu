import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import {
  Box,
  CircularProgress,
  Typography,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Button,
  IconButton,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import {
  VocabularyFlashcard,
  type RatingIntervals,
} from '../components/VocabularyFlashcard';
import { FinishedState } from '../components/FinishedState';
import { EmptyState } from '../components/EmptyState';
import { SettingsPanel } from '../components/SettingsPanel';
import vocabularyData from '../data/vocabulary.json';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyDirection,
} from '../types/vocabulary';
import loadVocabularyReviewData from '../lib/storage/loadVocabularyReviewData';
import saveVocabularyReviewData from '../lib/storage/saveVocabularyReviewData';
import loadVocabularySettings from '../lib/storage/loadVocabularySettings';
import saveVocabularySettings from '../lib/storage/saveVocabularySettings';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import clearVocabularyData from '../lib/storage/clearVocabularyData';
import getVocabularySessionCards from '../lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../lib/vocabularyScheduler/getVocabularyExtraNewCards';
import rateVocabularyCard from '../lib/vocabularyScheduler/rateVocabularyCard';
import getVocabularyNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { VocabularySessionCard } from '../lib/vocabularyScheduler/types';
import { useAuthContext } from '../hooks/useAuthContext';
import shuffleArray from '../lib/utils/shuffleArray';

const allWords: VocabularyWord[] = vocabularyData as VocabularyWord[];

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  newCardsPerDay: 10,
  direction: 'pl-en',
};

function getDefaultVocabularyReviewStore(): VocabularyReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: new Date().toISOString().split('T')[0],
  };
}

const LoadingContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const MainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

const ControlsRow = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const DirectionToggle = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    padding: theme.spacing(0.75, 2),
    fontSize: '0.875rem',
    textTransform: 'none',
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
  },
}));

const PracticeModeButton = styled(Button)<{ active?: boolean }>(
  ({ theme, active }) => ({
    textTransform: 'none',
    backgroundColor: active ? theme.palette.warning.main : 'transparent',
    color: active
      ? theme.palette.warning.contrastText
      : theme.palette.text.secondary,
    border: `1px solid ${
      active ? theme.palette.warning.main : theme.palette.divider
    }`,
    '&:hover': {
      backgroundColor: active
        ? theme.palette.warning.dark
        : theme.palette.action.hover,
    },
  })
);

export function VocabularyPage() {
  const { user } = useAuthContext();
  const [reviewStore, setReviewStore] = useState<VocabularyReviewDataStore>(
    getDefaultVocabularyReviewStore
  );
  const [settings, setSettings] = useState<VocabularySettings>(
    DEFAULT_VOCABULARY_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  const [learningQueue, setLearningQueue] = useState<VocabularySessionCard[]>(
    []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<VocabularyWord[]>([]);
  const [sessionQueue, setSessionQueue] = useState<VocabularySessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const directionRef = useRef(settings.direction);

  const buildSession = useCallback(
    (store: VocabularyReviewDataStore, currentSettings: VocabularySettings) => {
      const { reviewCards, newCards } = getVocabularySessionCards(
        allWords,
        store,
        currentSettings
      );
      setSessionQueue([...reviewCards, ...newCards]);
      setReviewCount(reviewCards.length);
      setNewCount(newCards.length);
      setLearningQueue([]);
      setCurrentIndex(0);
      setIsPracticeAhead(false);
    },
    []
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const loadedSettings = await loadVocabularySettings();
      const loadedReviewData = await loadVocabularyReviewData(
        loadedSettings.direction
      );
      directionRef.current = loadedSettings.direction;
      setSettings(loadedSettings);
      setReviewStore(loadedReviewData);
      buildSession(loadedReviewData, loadedSettings);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDirectionChange = useCallback(
    async (
      _: React.MouseEvent<HTMLElement>,
      newDirection: VocabularyDirection | null
    ) => {
      if (newDirection === null || newDirection === settings.direction) return;

      setIsLoading(true);
      const newSettings = { ...settings, direction: newDirection };
      directionRef.current = newDirection;
      setSettings(newSettings);
      await saveVocabularySettings(newSettings);

      const newReviewStore = await loadVocabularyReviewData(newDirection);
      setReviewStore(newReviewStore);
      buildSession(newReviewStore, newSettings);

      if (practiceMode) {
        setPracticeCards(shuffleArray([...allWords]));
        setPracticeIndex(0);
      }
      setIsLoading(false);
    },
    [settings, buildSession, practiceMode]
  );

  const startPracticeAhead = useCallback(() => {
    const aheadCards = getVocabularyPracticeAheadCards(
      allWords,
      reviewStore,
      practiceAheadCount
    );
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const extraCards = getVocabularyExtraNewCards(
      allWords,
      reviewStore,
      extraNewCardsCount
    );
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [reviewStore, extraNewCardsCount]);

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray([...allWords]));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished =
    currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const wordId = currentSessionCard.word.id;
    const updatedReviewData = rateVocabularyCard(
      currentSessionCard.reviewData,
      rating
    );

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[wordId] = updatedReviewData;

    if (currentSessionCard.isNew && !newStore.newCardsToday.includes(wordId)) {
      newStore.newCardsToday = [...newStore.newCardsToday, wordId];
    }

    if (rating === Rating.Again) {
      if (currentIndex < sessionQueue.length) {
        setLearningQueue((prev) => [
          ...prev,
          { ...currentSessionCard, reviewData: updatedReviewData },
        ]);
        setCurrentIndex((prev) => prev + 1);
      } else {
        const updated = learningQueue.map((item, idx) =>
          idx === 0 ? { ...item, reviewData: updatedReviewData } : item
        );
        setLearningQueue([...updated.slice(1), updated[0]]);
      }
    } else {
      if (!newStore.reviewedToday.includes(wordId)) {
        newStore.reviewedToday = [...newStore.reviewedToday, wordId];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setReviewStore(newStore);
    setRatingCounter((c) => c + 1);
    saveVocabularyReviewData(newStore, directionRef.current);
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    setSettings(newSettings);
    await saveVocabularySettings(newSettings);
    buildSession(reviewStore, newSettings);
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your vocabulary progress for this direction and cannot be undone.'
      )
    ) {
      await clearVocabularyData(settings.direction);
      const freshStore = await loadVocabularyReviewData(settings.direction);
      setReviewStore(freshStore);
      buildSession(freshStore, settings);
      setShowSettings(false);
    }
  };

  const intervals: RatingIntervals = useMemo(() => {
    if (!currentSessionCard) {
      return {
        [Rating.Again]: '',
        [Rating.Hard]: '',
        [Rating.Good]: '',
        [Rating.Easy]: '',
      };
    }
    const allIntervals = getVocabularyNextIntervals(
      getOrCreateVocabularyCardReviewData(
        currentSessionCard.word.id,
        reviewStore
      ).fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const totalRemaining =
    sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeWord = practiceCards[practiceIndex];

  if (isLoading) {
    return (
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    );
  }

  return (
    <>
      <ControlsRow
        direction="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <DirectionToggle
            value={settings.direction}
            exclusive
            onChange={handleDirectionChange}
            size="small"
          >
            <ToggleButton value="pl-en">PL → EN</ToggleButton>
            <ToggleButton value="en-pl">EN → PL</ToggleButton>
          </DirectionToggle>

          <PracticeModeButton
            active={practiceMode}
            onClick={togglePracticeMode}
            size="small"
          >
            Practice
          </PracticeModeButton>
        </Stack>

        <IconButton
          onClick={() => setShowSettings(!showSettings)}
          size="small"
          sx={{
            backgroundColor: showSettings ? 'action.selected' : 'transparent',
          }}
        >
          <SettingsIcon />
        </IconButton>
      </ControlsRow>

      {showSettings && !practiceMode && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${
            settings.direction === 'pl-en' ? 'PL→EN' : 'EN→PL'
          } Progress`}
        />
      )}

      <MainContent>
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ mb: { xs: 3, sm: 4 }, textAlign: 'center' }}
        >
          {practiceMode
            ? `Practice Mode · ${practiceCards.length} words`
            : isFinished
            ? ''
            : isPracticeAhead
            ? `Practice Ahead · ${totalRemaining} remaining`
            : `${reviewCount} reviews · ${newCount} new · ${totalRemaining} remaining`}
        </Typography>

        {practiceMode ? (
          currentPracticeWord ? (
            <VocabularyFlashcard
              key={`practice-${currentPracticeWord.id}-${practiceIndex}`}
              word={currentPracticeWord}
              direction={settings.direction}
              practiceMode
              onNext={handlePracticeNext}
            />
          ) : (
            <EmptyState message="No words available" />
          )
        ) : isFinished ? (
          <FinishedState
            practiceAheadCount={practiceAheadCount}
            setPracticeAheadCount={setPracticeAheadCount}
            extraNewCardsCount={extraNewCardsCount}
            setExtraNewCardsCount={setExtraNewCardsCount}
            onPracticeAhead={startPracticeAhead}
            onLearnExtra={startExtraNewCards}
          />
        ) : currentSessionCard ? (
          <VocabularyFlashcard
            key={`${currentSessionCard.word.id}-${ratingCounter}`}
            word={currentSessionCard.word}
            direction={settings.direction}
            intervals={intervals}
            onRate={handleRate}
          />
        ) : null}
      </MainContent>
    </>
  );
}

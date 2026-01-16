import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, Stack, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';
import { PracticeModeButton } from '../components/PracticeModeButton';
import { SettingsButton } from '../components/SettingsButton';
import { DirectionToggle } from '../components/DirectionToggle';
import {
  VocabularyFlashcard,
  type RatingIntervals,
} from '../components/VocabularyFlashcard';
import { FinishedState } from '../components/FinishedState';
import { EmptyState } from '../components/EmptyState';
import { SettingsPanel } from '../components/SettingsPanel';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import vocabularyData from '../data/vocabulary.json';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyDirection,
  CustomVocabularyWord,
} from '../types/vocabulary';
import loadVocabularyReviewData from '../lib/storage/loadVocabularyReviewData';
import saveVocabularyReviewData from '../lib/storage/saveVocabularyReviewData';
import loadVocabularySettings from '../lib/storage/loadVocabularySettings';
import saveVocabularySettings from '../lib/storage/saveVocabularySettings';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import clearVocabularyData from '../lib/storage/clearVocabularyData';
import {
  loadCustomVocabulary,
  addCustomWord,
  updateCustomWord,
  deleteCustomWord,
} from '../lib/storage/customVocabulary';
import getVocabularySessionCards from '../lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../lib/vocabularyScheduler/getVocabularyExtraNewCards';
import rateVocabularyCard from '../lib/vocabularyScheduler/rateVocabularyCard';
import getVocabularyNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { VocabularySessionCard } from '../lib/vocabularyScheduler/types';
import { useAuthContext } from '../hooks/useAuthContext';
import shuffleArray from '../lib/utils/shuffleArray';
import { includesWordId } from '../lib/storage/helpers';

const systemWords: VocabularyWord[] = vocabularyData as VocabularyWord[];

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  newCardsPerDay: 10,
  direction: 'pl-to-en',
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

const AddButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));


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

  const [customWords, setCustomWords] = useState<CustomVocabularyWord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<CustomVocabularyWord | null>(null);

  const directionRef = useRef(settings.direction);

  const allWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords]
  );

  const buildSession = useCallback(
    (
      words: VocabularyWord[],
      store: VocabularyReviewDataStore,
      currentSettings: VocabularySettings
    ) => {
      const { reviewCards, newCards } = getVocabularySessionCards(
        words,
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
      const [loadedSettings, loadedCustomWords] = await Promise.all([
        loadVocabularySettings(),
        loadCustomVocabulary(),
      ]);
      const loadedReviewData = await loadVocabularyReviewData(
        loadedSettings.direction
      );
      directionRef.current = loadedSettings.direction;
      setSettings(loadedSettings);
      setCustomWords(loadedCustomWords);
      setReviewStore(loadedReviewData);
      const mergedWords = [...loadedCustomWords, ...systemWords];
      buildSession(mergedWords, loadedReviewData, loadedSettings);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDirectionToggle = useCallback(async () => {
    const newDirection: VocabularyDirection =
      settings.direction === 'pl-to-en' ? 'en-to-pl' : 'pl-to-en';

    setIsLoading(true);
    const newSettings = { ...settings, direction: newDirection };
    directionRef.current = newDirection;
    setSettings(newSettings);
    await saveVocabularySettings(newSettings);

    const newReviewStore = await loadVocabularyReviewData(newDirection);
    setReviewStore(newReviewStore);
    buildSession(allWords, newReviewStore, newSettings);

    if (practiceMode) {
      setPracticeCards(shuffleArray([...allWords]));
      setPracticeIndex(0);
    }
    setIsLoading(false);
  }, [settings, buildSession, practiceMode, allWords]);

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
  }, [allWords, reviewStore, practiceAheadCount]);

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
  }, [allWords, reviewStore, extraNewCardsCount]);

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray([...allWords]));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, allWords]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished =
    currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const wordId = currentSessionCard.word.id;
    const wordIdKey = String(wordId);
    const updatedReviewData = rateVocabularyCard(
      currentSessionCard.reviewData,
      rating
    );

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[wordIdKey] = updatedReviewData;

    if (currentSessionCard.isNew && !includesWordId(newStore.newCardsToday, wordId)) {
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
      if (!includesWordId(newStore.reviewedToday, wordId)) {
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
    buildSession(allWords, reviewStore, newSettings);
  };

  const handleAddWord = async (
    wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => {
    const newWord = await addCustomWord(wordData);
    const newCustomWords = [...customWords, newWord];
    setCustomWords(newCustomWords);
    const mergedWords = [...newCustomWords, ...systemWords];
    buildSession(mergedWords, reviewStore, settings);
  };

  const handleEditWord = async (
    wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => {
    if (!editingWord) return;
    await updateCustomWord(editingWord.id, wordData);
    const newCustomWords = customWords.map((w) =>
      w.id === editingWord.id ? { ...w, ...wordData } : w
    );
    setCustomWords(newCustomWords);
    setEditingWord(null);

    setSessionQueue((prev) =>
      prev.map((card) =>
        card.word.id === editingWord.id
          ? { ...card, word: { ...card.word, ...wordData } }
          : card
      )
    );
    setLearningQueue((prev) =>
      prev.map((card) =>
        card.word.id === editingWord.id
          ? { ...card, word: { ...card.word, ...wordData } }
          : card
      )
    );
    setPracticeCards((prev) =>
      prev.map((word) =>
        word.id === editingWord.id ? { ...word, ...wordData } : word
      )
    );
  };

  const handleDeleteWord = async () => {
    if (!currentSessionCard?.word.isCustom) return;
    const wordId = currentSessionCard.word.id as string;
    
    if (!window.confirm('Are you sure you want to delete this custom word?')) {
      return;
    }

    await deleteCustomWord(wordId);
    const newCustomWords = customWords.filter((w) => w.id !== wordId);
    setCustomWords(newCustomWords);

    if (currentIndex < sessionQueue.length) {
      setSessionQueue((prev) => prev.filter((card) => card.word.id !== wordId));
    } else {
      setLearningQueue((prev) => prev.filter((card) => card.word.id !== wordId));
    }
    setPracticeCards((prev) => prev.filter((word) => word.id !== wordId));
  };

  const handleOpenEditModal = () => {
    if (currentSessionCard?.word.isCustom) {
      setEditingWord(currentSessionCard.word as CustomVocabularyWord);
      setShowAddModal(true);
    }
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
      buildSession(allWords, freshStore, settings);
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
      <ControlsRow direction="row" alignItems="center">
        <DirectionToggle
          direction={settings.direction}
          onToggle={handleDirectionToggle}
        />

        <PracticeModeButton active={practiceMode} onClick={togglePracticeMode} />

        <SettingsButton
          active={showSettings}
          onClick={() => setShowSettings(!showSettings)}
        />

        {user && (
          <AddButton onClick={() => setShowAddModal(true)} aria-label="add word">
            <AddIcon />
          </AddButton>
        )}
      </ControlsRow>

      {showSettings && !practiceMode && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${
            settings.direction === 'pl-to-en' ? 'PL→EN' : 'EN→PL'
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
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteWord}
          />
        ) : null}
      </MainContent>

      <AddVocabularyModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingWord(null);
        }}
        onSave={editingWord ? handleEditWord : handleAddWord}
        editWord={editingWord}
      />
    </>
  );
}

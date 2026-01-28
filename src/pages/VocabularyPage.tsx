import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, Stack } from '@mui/material';
import { styled } from '../lib/styled';
import { AddButton } from '../components/AddButton';
import { PracticeModeButton } from '../components/PracticeModeButton';
import { SettingsButton } from '../components/SettingsButton';
import { VocabularyFlashcard, type RatingIntervals } from '../components/VocabularyFlashcard';
import { VocabularyModeSelector } from '../components/VocabularyModeSelector';
import { FinishedState } from '../components/FinishedState';
import { EmptyState } from '../components/EmptyState';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { SettingsPanel } from '../components/SettingsPanel';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import type {
  VocabularyWord,
  VocabularyWordId,
  VocabularyReviewDataStore,
  VocabularyDirectionSettings,
  VocabularyDirection,
  CustomVocabularyWord,
} from '../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import { saveCustomVocabulary } from '../lib/storage/customVocabulary';
import {
  updateSystemVocabularyWord,
  deleteSystemVocabularyWord,
} from '../lib/storage/systemVocabulary';
import getVocabularySessionCards from '../lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../lib/vocabularyScheduler/getVocabularyExtraNewCards';
import rateVocabularyCard from '../lib/vocabularyScheduler/rateVocabularyCard';
import getVocabularyNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { VocabularySessionCard } from '../lib/vocabularyScheduler/types';
import { useAuthContext } from '../hooks/useAuthContext';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import { useReviewData } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';
import shuffleArray from '../lib/utils/shuffleArray';
import { includesWordId } from '../lib/storage/helpers';

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

interface VocabularyPageProps {
  mode?: VocabularyDirection;
}

export function VocabularyPage({ mode }: VocabularyPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    loading: contextLoading,
    vocabularyReviewStores,
    vocabularySettings: settings,
    vocabularyWords,
    customWords: contextCustomWords,
    systemWords: contextSystemWords,
    updateVocabularyReviewStore,
    updateVocabularySettings,
    clearVocabularyReviewData,
    setCustomWords: setContextCustomWords,
    setSystemWords: setContextSystemWords,
  } = useReviewData();

  const [systemWords, applyOptimisticSystemWords] = useOptimistic(contextSystemWords, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });
  const [customWords, applyOptimisticCustomWords] = useOptimistic(contextCustomWords, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  const [learningQueue, setLearningQueue] = useState<VocabularySessionCard[]>([]);
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<CustomVocabularyWord | VocabularyWord | null>(
    null
  );
  const [editingSystemWord, setEditingSystemWord] = useState(false);

  const sessionBuiltRef = useRef(false);
  const currentDirection = mode ?? 'pl-to-en';
  const directionRef = useRef(currentDirection);

  const directionSettings = settings[currentDirection];
  const reviewStore = vocabularyReviewStores[currentDirection];

  const allWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  const buildSession = useCallback(
    (
      words: VocabularyWord[],
      store: VocabularyReviewDataStore,
      currentSettings: VocabularyDirectionSettings
    ) => {
      const { reviewCards, newCards } = getVocabularySessionCards(words, store, currentSettings);
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
    if (!contextLoading && !sessionBuiltRef.current) {
      sessionBuiltRef.current = true;
      directionRef.current = currentDirection;
      queueMicrotask(() => {
        buildSession(vocabularyWords, reviewStore, directionSettings);
      });
    }
  }, [
    contextLoading,
    buildSession,
    vocabularyWords,
    reviewStore,
    directionSettings,
    currentDirection,
  ]);

  const progressStats = useProgressStats();
  const modeStats = {
    'pl-to-en': {
      dueCount: progressStats.vocabularyByDirection['pl-to-en'].due,
      learnedCount: progressStats.vocabularyByDirection['pl-to-en'].learned,
      totalCount: progressStats.vocabularyByDirection['pl-to-en'].total,
    },
    'en-to-pl': {
      dueCount: progressStats.vocabularyByDirection['en-to-pl'].due,
      learnedCount: progressStats.vocabularyByDirection['en-to-pl'].learned,
      totalCount: progressStats.vocabularyByDirection['en-to-pl'].total,
    },
  };

  const handleSelectMode = useCallback(
    (direction: VocabularyDirection) => {
      const route = direction === 'pl-to-en' ? 'recognition' : 'production';
      navigate(`/vocabulary/${route}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (!mode || contextLoading) return;

    if (directionRef.current !== mode) {
      directionRef.current = mode;
      const modeSettings = settings[mode];
      const modeReviewStore = vocabularyReviewStores[mode];
      queueMicrotask(() => {
        buildSession(allWords, modeReviewStore, modeSettings);
      });
    }
  }, [mode, contextLoading, settings, vocabularyReviewStores, allWords, buildSession]);

  const startPracticeAhead = useCallback(() => {
    const aheadCards = getVocabularyPracticeAheadCards(allWords, reviewStore, practiceAheadCount);
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [allWords, reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const extraCards = getVocabularyExtraNewCards(allWords, reviewStore, extraNewCardsCount);
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
  const isFinished = currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const wordId = currentSessionCard.word.id;
    const wordIdKey = String(wordId);
    const updatedReviewData = rateVocabularyCard(currentSessionCard.reviewData, rating);

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

    setRatingCounter((c) => c + 1);
    await updateVocabularyReviewStore(directionRef.current, newStore);
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateVocabularySettings(currentDirection, newSettings);
    buildSession(allWords, reviewStore, newSettings);
  };

  const handleAddWord = (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
    const newWord: CustomVocabularyWord = {
      ...wordData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const newCustomWords = [...customWords, newWord];

    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setContextCustomWords(newCustomWords);
    });

    const mergedWords = [...newCustomWords, ...systemWords];
    buildSession(mergedWords, reviewStore, directionSettings);
  };

  const updateWordInQueues = (wordId: VocabularyWordId, updates: Partial<VocabularyWord>) => {
    setSessionQueue((prev) =>
      prev.map((card) =>
        card.word.id === wordId ? { ...card, word: { ...card.word, ...updates } } : card
      )
    );
    setLearningQueue((prev) =>
      prev.map((card) =>
        card.word.id === wordId ? { ...card, word: { ...card.word, ...updates } } : card
      )
    );
    setPracticeCards((prev) =>
      prev.map((word) => (word.id === wordId ? { ...word, ...updates } : word))
    );
  };

  const removeWordFromQueues = (wordId: VocabularyWordId) => {
    if (currentIndex < sessionQueue.length) {
      setSessionQueue((prev) => prev.filter((card) => card.word.id !== wordId));
    } else {
      setLearningQueue((prev) => prev.filter((card) => card.word.id !== wordId));
    }
    setPracticeCards((prev) => prev.filter((word) => word.id !== wordId));
  };

  const handleEditWord = (
    wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>
  ) => {
    if (!editingWord) return;

    const wordId = editingWord.id;

    const mergeWordData = <T extends VocabularyWord>(w: T): T => ({
      ...w,
      polish: wordData.polish,
      english: wordData.english,
      partOfSpeech: wordData.partOfSpeech,
      gender: wordData.gender,
      notes: wordData.notes,
      examples: wordData.examples,
    });

    if (editingSystemWord) {
      const newSystemWords = systemWords.map((w) => (w.id === wordId ? mergeWordData(w) : w));
      setEditingWord(null);
      setEditingSystemWord(false);

      applyOptimisticSystemWords(newSystemWords, async () => {
        await updateSystemVocabularyWord(wordId as number, wordData);
        setContextSystemWords(newSystemWords);
      });
    } else {
      const newCustomWords = customWords.map((w) => (w.id === wordId ? mergeWordData(w) : w));
      setEditingWord(null);

      applyOptimisticCustomWords(newCustomWords, async () => {
        await saveCustomVocabulary(newCustomWords);
        setContextCustomWords(newCustomWords);
      });
    }

    updateWordInQueues(wordId, wordData);
  };

  const handleDeleteWord = () => {
    if (!currentSessionCard) return;

    const word = currentSessionCard.word;
    const isCustomWord = word.isCustom === true;
    const isSystemWord = !isCustomWord && isAdmin;

    if (!isCustomWord && !isSystemWord) return;

    const confirmMessage = isCustomWord
      ? 'Are you sure you want to delete this custom word?'
      : 'Are you sure you want to delete this system vocabulary word? This will affect all users.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const wordId = word.id;

    if (isCustomWord) {
      const newCustomWords = customWords.filter((w) => w.id !== wordId);

      applyOptimisticCustomWords(newCustomWords, async () => {
        await saveCustomVocabulary(newCustomWords);
        setContextCustomWords(newCustomWords);
      });
    } else {
      const newSystemWords = systemWords.filter((w) => w.id !== wordId);

      applyOptimisticSystemWords(newSystemWords, async () => {
        await deleteSystemVocabularyWord(wordId as number);
        setContextSystemWords(newSystemWords);
      });
    }

    removeWordFromQueues(wordId);
  };

  const handleOpenEditModal = () => {
    if (!currentSessionCard) return;

    const word = currentSessionCard.word;
    const isCustomWord = word.isCustom === true;
    const isSystemWord = !isCustomWord && isAdmin;

    if (isCustomWord) {
      setEditingWord(word as CustomVocabularyWord);
      setEditingSystemWord(false);
      setShowAddModal(true);
    } else if (isSystemWord) {
      setEditingWord(word);
      setEditingSystemWord(true);
      setShowAddModal(true);
    }
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your vocabulary progress for this direction and cannot be undone.'
      )
    ) {
      await clearVocabularyReviewData(currentDirection);
      const freshStore = vocabularyReviewStores[currentDirection];
      buildSession(allWords, freshStore, directionSettings);
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
      getOrCreateVocabularyCardReviewData(currentSessionCard.word.id, reviewStore).fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const totalRemaining = sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeWord = practiceCards[practiceIndex];

  const isLoading = contextLoading;

  if (!mode) {
    return (
      <VocabularyModeSelector
        stats={modeStats}
        loading={contextLoading}
        onSelectMode={handleSelectMode}
      />
    );
  }

  return (
    <>
      <ControlsRow direction="row" alignItems="center">
        <PracticeModeButton
          active={practiceMode}
          onClick={togglePracticeMode}
          disabled={isLoading}
        />

        <SettingsButton
          active={showSettings}
          onClick={() => setShowSettings(!showSettings)}
          disabled={isLoading}
        />

        {user && (
          <AddButton
            onClick={() => setShowAddModal(true)}
            aria-label="add word"
            disabled={isLoading}
          />
        )}
      </ControlsRow>

      {showSettings && !practiceMode && (
        <SettingsPanel
          newCardsPerDay={directionSettings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${currentDirection === 'pl-to-en' ? 'PL→EN' : 'EN→PL'} Progress`}
        />
      )}

      <MainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <>
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{
                mb: { xs: 3, sm: 4 },
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              {practiceMode ? (
                `Practice Mode · ${practiceCards.length} words`
              ) : isFinished ? null : isPracticeAhead ? (
                <>
                  Practice Ahead · <ReviewCountBadge count={totalRemaining} /> remaining
                </>
              ) : (
                <>
                  {reviewCount} reviews · {newCount} new ·{' '}
                  <ReviewCountBadge count={totalRemaining} /> remaining
                </>
              )}
            </Typography>

            {practiceMode ? (
              currentPracticeWord ? (
                <VocabularyFlashcard
                  key={`practice-${currentPracticeWord.id}-${practiceIndex}`}
                  word={currentPracticeWord}
                  direction={currentDirection}
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
                direction={currentDirection}
                intervals={intervals}
                isAdmin={isAdmin}
                onRate={handleRate}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteWord}
              />
            ) : null}
          </>
        )}
      </MainContent>

      <AddVocabularyModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingWord(null);
          setEditingSystemWord(false);
        }}
        onSave={editingWord ? handleEditWord : handleAddWord}
        editWord={editingWord}
      />
    </>
  );
}

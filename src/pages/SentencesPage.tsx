import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, Stack } from '@mui/material';
import { styled } from '../lib/styled';
import { AddButton } from '../components/AddButton';
import { PracticeModeButton } from '../components/PracticeModeButton';
import { SettingsButton } from '../components/SettingsButton';
import { SentenceFlashcard, type RatingIntervals } from '../components/SentenceFlashcard';
import { SentenceModeSelector } from '../components/SentenceModeSelector';
import { FinishedState } from '../components/FinishedState';
import { EmptyState } from '../components/EmptyState';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { SentenceSettingsPanel } from '../components/SentenceSettingsPanel';
import { EditSentenceModal } from '../components/EditSentenceModal';
import type {
  Sentence,
  CustomSentence,
  SentenceReviewDataStore,
  SentenceDirectionSettings,
  SentenceDirection,
  CEFRLevel,
} from '../types/sentences';
import getOrCreateSentenceCardReviewData from '../lib/storage/getOrCreateSentenceCardReviewData';
import getSentenceSessionCards from '../lib/sentenceScheduler/getSentenceSessionCards';
import getSentencePracticeAheadCards from '../lib/sentenceScheduler/getSentencePracticeAheadCards';
import getSentenceExtraNewCards from '../lib/sentenceScheduler/getSentenceExtraNewCards';
import rateSentenceCard from '../lib/sentenceScheduler/rateSentenceCard';
import getNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { SentenceSessionCard } from '../lib/sentenceScheduler/types';
import { useAuthContext } from '../hooks/useAuthContext';
import { useReviewData } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import { useTranslationContext } from '../hooks/useTranslationContext';
import {
  updateSentence,
  deleteSentence,
  updateSentenceTranslation,
} from '../lib/storage/systemSentences';
import { saveCustomSentences } from '../lib/storage/customSentences';
import shuffleArray from '../lib/utils/shuffleArray';
import { includesSentenceId } from '../lib/storage/helpers';

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

interface SentencesPageProps {
  mode?: SentenceDirection;
}

export function SentencesPage({ mode }: SentencesPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const { handleDailyLimitReached } = useTranslationContext();
  const {
    loading: contextLoading,
    sentenceReviewStores,
    sentenceSettings: settings,
    sentences: contextSentences,
    customSentences: contextCustomSentences,
    systemSentences: contextSystemSentences,
    updateSentenceReviewStore,
    updateSentenceSettings,
    clearSentenceReviewData,
    setSentences: setContextSentences,
    setCustomSentences: setContextCustomSentences,
  } = useReviewData();

  const [sentences, applyOptimisticSentences] = useOptimistic(contextSentences, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [customSentences, applyOptimisticCustomSentences] = useOptimistic(contextCustomSentences, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [isCreatingSentence, setIsCreatingSentence] = useState(false);

  const [learningQueue, setLearningQueue] = useState<SentenceSessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<Sentence[]>([]);
  const [sessionQueue, setSessionQueue] = useState<SentenceSessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const sessionBuiltRef = useRef(false);
  const currentDirection = mode ?? 'pl-to-en';
  const directionRef = useRef(currentDirection);

  const directionSettings = settings[currentDirection];
  const reviewStore = sentenceReviewStores[currentDirection];

  const filteredSentences = useMemo(
    () => contextSentences.filter((s) => directionSettings.selectedLevels.includes(s.level)),
    [contextSentences, directionSettings.selectedLevels]
  );

  const buildSession = useCallback(
    (
      allSentences: Sentence[],
      store: SentenceReviewDataStore,
      currentSettings: SentenceDirectionSettings
    ) => {
      const { reviewCards, newCards } = getSentenceSessionCards(
        allSentences,
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
    if (!contextLoading && !sessionBuiltRef.current) {
      sessionBuiltRef.current = true;
      directionRef.current = currentDirection;
      queueMicrotask(() => {
        buildSession(filteredSentences, reviewStore, directionSettings);
      });
    }
  }, [
    contextLoading,
    buildSession,
    filteredSentences,
    reviewStore,
    directionSettings,
    currentDirection,
  ]);

  const progressStats = useProgressStats();
  const modeStats = progressStats.sentencesByDirection;

  const handleSelectMode = useCallback(
    (direction: SentenceDirection) => {
      const route = direction === 'pl-to-en' ? 'recognition' : 'production';
      navigate(`/sentences/${route}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (!mode || contextLoading) return;

    if (directionRef.current !== mode) {
      directionRef.current = mode;
      const modeSettings = settings[mode];
      const modeReviewStore = sentenceReviewStores[mode];
      const modeSentences = contextSentences.filter((s) =>
        modeSettings.selectedLevels.includes(s.level)
      );
      queueMicrotask(() => {
        buildSession(modeSentences, modeReviewStore, modeSettings);
      });
    }
  }, [mode, contextLoading, settings, sentenceReviewStores, contextSentences, buildSession]);

  const startPracticeAhead = useCallback(() => {
    const aheadCards = getSentencePracticeAheadCards(
      filteredSentences,
      reviewStore,
      practiceAheadCount
    );
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [filteredSentences, reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const extraCards = getSentenceExtraNewCards(filteredSentences, reviewStore, extraNewCardsCount);
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [filteredSentences, reviewStore, extraNewCardsCount]);

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray([...filteredSentences]));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, filteredSentences]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished = currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const sentenceId = currentSessionCard.sentence.id;
    const updatedReviewData = rateSentenceCard(currentSessionCard.reviewData, rating);

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[sentenceId] = updatedReviewData;

    if (currentSessionCard.isNew && !includesSentenceId(newStore.newCardsToday, sentenceId)) {
      newStore.newCardsToday = [...newStore.newCardsToday, sentenceId];
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
      if (!includesSentenceId(newStore.reviewedToday, sentenceId)) {
        newStore.reviewedToday = [...newStore.reviewedToday, sentenceId];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setRatingCounter((c) => c + 1);
    await updateSentenceReviewStore(directionRef.current, newStore);
  };

  const handleNewCardsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateSentenceSettings(currentDirection, newSettings);
    const filtered = contextSentences.filter((s) => newSettings.selectedLevels.includes(s.level));
    buildSession(filtered, reviewStore, newSettings);
  };

  const handleLevelsChange = async (selectedLevels: CEFRLevel[]) => {
    const newSettings = { ...directionSettings, selectedLevels };
    await updateSentenceSettings(currentDirection, newSettings);
    const filtered = contextSentences.filter((s) => selectedLevels.includes(s.level));

    if (practiceMode) {
      setPracticeCards(shuffleArray([...filtered]));
      setPracticeIndex(0);
    } else {
      buildSession(filtered, reviewStore, newSettings);
    }
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your sentence progress for this direction and cannot be undone.'
      )
    ) {
      await clearSentenceReviewData(currentDirection);
      const freshStore = sentenceReviewStores[currentDirection];
      buildSession(filteredSentences, freshStore, directionSettings);
      setShowSettings(false);
    }
  };

  const handleOpenEditModal = useCallback(() => {
    if (!currentSessionCard) return;
    setEditingSentence(currentSessionCard.sentence);
    setIsCreatingSentence(false);
    setShowEditModal(true);
  }, [currentSessionCard]);

  const updateSentenceInQueues = (sentenceId: string, updatedSentence: Sentence) => {
    setSessionQueue((prev) =>
      prev.map((item) =>
        item.sentence.id === sentenceId ? { ...item, sentence: updatedSentence } : item
      )
    );
    setLearningQueue((prev) =>
      prev.map((item) =>
        item.sentence.id === sentenceId ? { ...item, sentence: updatedSentence } : item
      )
    );
    setPracticeCards((prev) => prev.map((s) => (s.id === sentenceId ? updatedSentence : s)));
  };

  const removeSentenceFromQueues = (sentenceId: string) => {
    setSessionQueue((prev) => prev.filter((item) => item.sentence.id !== sentenceId));
    setLearningQueue((prev) => prev.filter((item) => item.sentence.id !== sentenceId));
    setPracticeCards((prev) => prev.filter((s) => s.id !== sentenceId));
  };

  const handleAddSentence = useCallback(
    (sentenceData: Omit<Sentence, 'id'>) => {
      const newSentence: CustomSentence = {
        ...sentenceData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomSentences = [...customSentences, newSentence];

      applyOptimisticCustomSentences(newCustomSentences, async () => {
        await saveCustomSentences(newCustomSentences);
        setContextCustomSentences(newCustomSentences);
      });

      const mergedSentences = [...newCustomSentences, ...contextSystemSentences];
      const filtered = mergedSentences.filter((s) =>
        directionSettings.selectedLevels.includes(s.level)
      );
      buildSession(filtered, reviewStore, directionSettings);
    },
    [
      customSentences,
      contextSystemSentences,
      applyOptimisticCustomSentences,
      setContextCustomSentences,
      buildSession,
      reviewStore,
      directionSettings,
    ]
  );

  const handleSaveSentence = useCallback(
    (sentenceData: Omit<Sentence, 'id'>) => {
      if (!editingSentence) return;

      const updatedSentence: Sentence = {
        ...editingSentence,
        ...sentenceData,
      };

      const newSentences = sentences.map((s) =>
        s.id === editingSentence.id ? updatedSentence : s
      );

      updateSentenceInQueues(editingSentence.id, updatedSentence);

      applyOptimisticSentences(newSentences, async () => {
        await updateSentence(editingSentence.id, sentenceData);
        setContextSentences(newSentences);
      });
    },
    [editingSentence, sentences, applyOptimisticSentences, setContextSentences]
  );

  const handleDeleteSentence = useCallback(() => {
    if (!currentSessionCard) return;

    const sentenceToDelete = currentSessionCard.sentence;
    const newSentences = sentences.filter((s) => s.id !== sentenceToDelete.id);

    removeSentenceFromQueues(sentenceToDelete.id);

    applyOptimisticSentences(newSentences, async () => {
      await deleteSentence(sentenceToDelete.id);
      setContextSentences(newSentences);
    });
  }, [currentSessionCard, sentences, applyOptimisticSentences, setContextSentences]);

  const handleUpdateTranslation = useCallback(
    async (sentenceId: string, word: string, translation: string) => {
      const sentence = sentences.find((s) => s.id === sentenceId);
      if (!sentence) return;

      const updatedTranslations = { ...sentence.translations, [word]: translation };
      const updatedSentence = { ...sentence, translations: updatedTranslations };

      updateSentenceInQueues(sentenceId, updatedSentence);

      const newSentences = sentences.map((s) => (s.id === sentenceId ? updatedSentence : s));

      applyOptimisticSentences(newSentences, async () => {
        await updateSentenceTranslation(sentenceId, word, translation);
        setContextSentences(newSentences);
      });
    },
    [sentences, applyOptimisticSentences, setContextSentences]
  );

  const intervals: RatingIntervals = useMemo(() => {
    if (!currentSessionCard) {
      return {
        [Rating.Again]: '',
        [Rating.Hard]: '',
        [Rating.Good]: '',
        [Rating.Easy]: '',
      };
    }
    const allIntervals = getNextIntervals(
      getOrCreateSentenceCardReviewData(currentSessionCard.sentence.id, reviewStore).fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const totalRemaining = sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeSentence = practiceCards[practiceIndex];

  const isLoading = contextLoading;

  if (!mode) {
    return (
      <SentenceModeSelector
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
            onClick={() => {
              setIsCreatingSentence(true);
              setShowEditModal(true);
            }}
            aria-label="add sentence"
            disabled={isLoading}
          />
        )}
      </ControlsRow>

      {showSettings && (
        <SentenceSettingsPanel
          newCardsPerDay={directionSettings.newCardsPerDay}
          selectedLevels={directionSettings.selectedLevels}
          user={user}
          onNewCardsChange={handleNewCardsChange}
          onLevelsChange={handleLevelsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${currentDirection === 'pl-to-en' ? 'PL→EN' : 'EN→PL'} Progress`}
          practiceMode={practiceMode}
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
                `Practice Mode · ${practiceCards.length} sentences`
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
              currentPracticeSentence ? (
                <SentenceFlashcard
                  key={`practice-${currentPracticeSentence.id}-${practiceIndex}`}
                  sentence={currentPracticeSentence}
                  direction={currentDirection}
                  practiceMode
                  isAdmin={isAdmin}
                  onNext={handlePracticeNext}
                  onDailyLimitReached={handleDailyLimitReached}
                  onUpdateTranslation={
                    isAdmin
                      ? (word, translation) =>
                          handleUpdateTranslation(currentPracticeSentence.id, word, translation)
                      : undefined
                  }
                />
              ) : (
                <EmptyState message="No sentences available" />
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
              <SentenceFlashcard
                key={`${currentSessionCard.sentence.id}-${ratingCounter}`}
                sentence={currentSessionCard.sentence}
                direction={currentDirection}
                intervals={intervals}
                canEdit={isAdmin}
                isAdmin={isAdmin}
                onRate={handleRate}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteSentence}
                onDailyLimitReached={handleDailyLimitReached}
                onUpdateTranslation={
                  isAdmin
                    ? (word, translation) =>
                        handleUpdateTranslation(currentSessionCard.sentence.id, word, translation)
                    : undefined
                }
              />
            ) : null}
          </>
        )}
      </MainContent>

      <EditSentenceModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingSentence(null);
          setIsCreatingSentence(false);
        }}
        onSave={isCreatingSentence ? handleAddSentence : handleSaveSentence}
        sentence={editingSentence}
        isCreating={isCreatingSentence}
      />
    </>
  );
}

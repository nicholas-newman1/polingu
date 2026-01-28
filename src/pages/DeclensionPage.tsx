import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, styled } from '@mui/material';
import {
  DeclensionFlashcard,
  type DeclensionRatingIntervals,
} from '../components/DeclensionFlashcard';
import { DeclensionFilterControls } from '../components/DeclensionFilterControls';
import { SettingsPanel } from '../components/SettingsPanel';
import { FinishedState } from '../components/FinishedState';
import { EmptyState } from '../components/EmptyState';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { EditDeclensionModal } from '../components/EditDeclensionModal';
import type {
  DeclensionCard,
  CustomDeclensionCard,
  Case,
  Gender,
  Number,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../types';
import {
  updateDeclensionCard,
  updateDeclensionCardTranslation,
} from '../lib/storage/systemDeclension';
import { saveCustomDeclension } from '../lib/storage/customDeclension';
import { includesDeclensionCardId } from '../lib/storage/helpers';
import { generateCustomId } from '../types/customItems';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getDeclensionSessionCards from '../lib/declensionScheduler/getSessionCards';
import getDeclensionPracticeAheadCards from '../lib/declensionScheduler/getPracticeAheadCards';
import getDeclensionExtraNewCards from '../lib/declensionScheduler/getExtraNewCards';
import rateCard from '../lib/fsrsUtils/rateCard';
import getNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { DeclensionSessionCard } from '../lib/declensionScheduler/types';
import { useAuthContext } from '../hooks/useAuthContext';
import { useReviewData } from '../hooks/useReviewData';
import { useOptimistic } from '../hooks/useOptimistic';
import { useSnackbar } from '../hooks/useSnackbar';
import { DEFAULT_DECLENSION_SETTINGS } from '../constants';
import shuffleArray from '../lib/utils/shuffleArray';

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

export function DeclensionPage() {
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    loading: contextLoading,
    customDeclensionCards: contextCustomDeclensionCards,
    systemDeclensionCards: contextSystemDeclensionCards,
    declensionReviewStore: reviewStore,
    declensionSettings: settings,
    updateDeclensionReviewStore,
    updateDeclensionSettings,
    clearDeclensionData,
    setCustomDeclensionCards: setContextCustomDeclensionCards,
    setSystemDeclensionCards: setContextSystemDeclensionCards,
  } = useReviewData();

  const [customDeclensionCards, applyOptimisticCustomCards] = useOptimistic(
    contextCustomDeclensionCards,
    {
      onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
    }
  );

  const [systemDeclensionCards, applyOptimisticSystemCards] = useOptimistic(
    contextSystemDeclensionCards,
    {
      onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
    }
  );

  const allDeclensionCards = useMemo(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<DeclensionCard | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [caseFilter, setCaseFilter] = useState<Case[]>([]);
  const [genderFilter, setGenderFilter] = useState<Gender[]>([]);
  const [numberFilter, setNumberFilter] = useState<Number | 'All'>('All');

  const [learningQueue, setLearningQueue] = useState<DeclensionSessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<DeclensionCard[]>([]);
  const [sessionQueue, setSessionQueue] = useState<DeclensionSessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);
  const [sessionReady, setSessionReady] = useState(false);
  const sessionBuiltRef = useRef(false);

  const filteredCards = useMemo(() => {
    return allDeclensionCards.filter((card) => {
      if (caseFilter.length > 0 && !caseFilter.includes(card.case)) return false;
      if (genderFilter.length > 0 && !genderFilter.includes(card.gender)) return false;
      if (numberFilter !== 'All' && card.number !== numberFilter) return false;
      return true;
    });
  }, [allDeclensionCards, caseFilter, genderFilter, numberFilter]);

  const buildSession = useCallback(
    (store: DeclensionReviewDataStore, currentSettings: DeclensionSettings) => {
      const filters = {
        cases: caseFilter,
        genders: genderFilter,
        number: numberFilter,
      };
      const { reviewCards, newCards } = getDeclensionSessionCards(
        allDeclensionCards,
        store,
        filters,
        currentSettings
      );
      setSessionQueue([...reviewCards, ...newCards]);
      setReviewCount(reviewCards.length);
      setNewCount(newCards.length);
      setLearningQueue([]);
      setCurrentIndex(0);
    },
    [allDeclensionCards, caseFilter, genderFilter, numberFilter]
  );

  useEffect(() => {
    if (!contextLoading && !sessionBuiltRef.current && allDeclensionCards.length > 0) {
      sessionBuiltRef.current = true;
      queueMicrotask(() => {
        buildSession(reviewStore, settings);
        setSessionReady(true);
      });
    }
  }, [contextLoading, buildSession, reviewStore, settings, allDeclensionCards.length]);

  const resetSession = useCallback(() => {
    buildSession(reviewStore, settings);
  }, [buildSession, reviewStore, settings]);

  const startPracticeAhead = useCallback(() => {
    const filters = {
      cases: caseFilter,
      genders: genderFilter,
      number: numberFilter,
    };
    const aheadCards = getDeclensionPracticeAheadCards(
      allDeclensionCards,
      reviewStore,
      filters,
      practiceAheadCount
    );
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [allDeclensionCards, caseFilter, genderFilter, numberFilter, reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const filters = {
      cases: caseFilter,
      genders: genderFilter,
      number: numberFilter,
    };
    const extraCards = getDeclensionExtraNewCards(
      allDeclensionCards,
      reviewStore,
      filters,
      extraNewCardsCount
    );
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [allDeclensionCards, caseFilter, genderFilter, numberFilter, reviewStore, extraNewCardsCount]);

  const handleFilterChange = useCallback(
    (newCaseFilter: Case[], newGenderFilter: Gender[], newNumberFilter: Number | 'All') => {
      if (practiceMode) {
        setPracticeCards(
          shuffleArray(
            allDeclensionCards.filter((card) => {
              if (newCaseFilter.length > 0 && !newCaseFilter.includes(card.case)) return false;
              if (newGenderFilter.length > 0 && !newGenderFilter.includes(card.gender))
                return false;
              if (newNumberFilter !== 'All' && card.number !== newNumberFilter) return false;
              return true;
            })
          )
        );
        setPracticeIndex(0);
      }
    },
    [allDeclensionCards, practiceMode]
  );

  const handleCaseChange = useCallback(
    (value: Case[]) => {
      setCaseFilter(value);
      resetSession();
      handleFilterChange(value, genderFilter, numberFilter);
    },
    [resetSession, handleFilterChange, genderFilter, numberFilter]
  );

  const handleGenderChange = useCallback(
    (value: Gender[]) => {
      setGenderFilter(value);
      resetSession();
      handleFilterChange(caseFilter, value, numberFilter);
    },
    [resetSession, handleFilterChange, caseFilter, numberFilter]
  );

  const handleNumberChange = useCallback(
    (value: Number | 'All') => {
      setNumberFilter(value);
      resetSession();
      handleFilterChange(caseFilter, genderFilter, value);
    },
    [resetSession, handleFilterChange, caseFilter, genderFilter]
  );

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray(filteredCards));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, filteredCards]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished = currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    const updatedReviewData = rateCard(currentSessionCard.reviewData, rating);

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[currentSessionCard.card.id] = updatedReviewData;

    if (
      currentSessionCard.isNew &&
      !includesDeclensionCardId(newStore.newCardsToday, currentSessionCard.card.id)
    ) {
      newStore.newCardsToday = [...newStore.newCardsToday, currentSessionCard.card.id];
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
      if (!includesDeclensionCardId(newStore.reviewedToday, currentSessionCard.card.id)) {
        newStore.reviewedToday = [...newStore.reviewedToday, currentSessionCard.card.id];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setRatingCounter((c) => c + 1);
    await updateDeclensionReviewStore(newStore);
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    await updateDeclensionSettings(newSettings);
  };

  const handleResetAllData = async () => {
    if (window.confirm('Are you sure? This will erase all your progress and cannot be undone.')) {
      await clearDeclensionData();
      buildSession(reviewStore, DEFAULT_DECLENSION_SETTINGS);
      setShowSettings(false);
    }
  };

  const handleOpenEditModal = useCallback(() => {
    if (!currentSessionCard) return;
    setEditingCard(currentSessionCard.card);
    setIsCreatingNew(false);
    setShowEditModal(true);
  }, [currentSessionCard]);

  const handleOpenCreateModal = useCallback(() => {
    setEditingCard(null);
    setIsCreatingNew(true);
    setShowEditModal(true);
  }, []);

  const updateCardInQueues = (cardId: DeclensionCard['id'], updatedCard: DeclensionCard) => {
    setSessionQueue((prev) =>
      prev.map((item) => (item.card.id === cardId ? { ...item, card: updatedCard } : item))
    );
    setLearningQueue((prev) =>
      prev.map((item) => (item.card.id === cardId ? { ...item, card: updatedCard } : item))
    );
    setPracticeCards((prev) => prev.map((card) => (card.id === cardId ? updatedCard : card)));
  };

  const removeCardFromQueues = (cardId: DeclensionCard['id']) => {
    setSessionQueue((prev) => prev.filter((item) => item.card.id !== cardId));
    setLearningQueue((prev) => prev.filter((item) => item.card.id !== cardId));
    setPracticeCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const handleSaveCard = useCallback(
    (cardData: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
      if (isCreatingNew) {
        const newCard: CustomDeclensionCard = {
          ...cardData,
          id: generateCustomId(),
          isCustom: true,
          createdAt: Date.now(),
        };
        const newCustomCards = [...customDeclensionCards, newCard];

        applyOptimisticCustomCards(newCustomCards, async () => {
          await saveCustomDeclension(newCustomCards);
          setContextCustomDeclensionCards(newCustomCards);
        });

        buildSession(reviewStore, settings);
      } else if (editingCard) {
        const isCustomCard = editingCard.isCustom === true;
        const updatedCard = { ...editingCard, ...cardData };

        if (isCustomCard) {
          const newCustomCards = customDeclensionCards.map((card) =>
            card.id === editingCard.id ? { ...card, ...cardData } : card
          );

          updateCardInQueues(editingCard.id, updatedCard);

          applyOptimisticCustomCards(newCustomCards, async () => {
            await saveCustomDeclension(newCustomCards);
            setContextCustomDeclensionCards(newCustomCards);
          });
        } else {
          const newSystemCards = systemDeclensionCards.map((card) =>
            card.id === editingCard.id ? updatedCard : card
          );

          updateCardInQueues(editingCard.id, updatedCard);

          applyOptimisticSystemCards(newSystemCards, async () => {
            await updateDeclensionCard(editingCard.id as number, cardData);
            setContextSystemDeclensionCards(newSystemCards);
          });
        }
      }
    },
    [
      isCreatingNew,
      editingCard,
      customDeclensionCards,
      systemDeclensionCards,
      applyOptimisticCustomCards,
      applyOptimisticSystemCards,
      setContextCustomDeclensionCards,
      setContextSystemDeclensionCards,
      buildSession,
      reviewStore,
      settings,
    ]
  );

  const handleDeleteCard = useCallback(() => {
    if (!editingCard || !editingCard.isCustom) return;

    const newCustomCards = customDeclensionCards.filter((card) => card.id !== editingCard.id);

    removeCardFromQueues(editingCard.id);

    applyOptimisticCustomCards(newCustomCards, async () => {
      await saveCustomDeclension(newCustomCards);
      setContextCustomDeclensionCards(newCustomCards);
    });

    setShowEditModal(false);
    setEditingCard(null);
  }, [
    editingCard,
    customDeclensionCards,
    applyOptimisticCustomCards,
    setContextCustomDeclensionCards,
  ]);

  const handleUpdateTranslation = useCallback(
    async (cardId: DeclensionCard['id'], word: string, translation: string) => {
      const card = allDeclensionCards.find((c) => c.id === cardId);
      if (!card) return;

      const updatedTranslations = { ...card.translations, [word]: translation };
      const updatedCard = { ...card, translations: updatedTranslations };

      updateCardInQueues(cardId, updatedCard);

      if (card.isCustom) {
        const newCustomCards = customDeclensionCards.map((c) =>
          c.id === cardId ? { ...c, translations: updatedTranslations } : c
        );

        applyOptimisticCustomCards(newCustomCards, async () => {
          await saveCustomDeclension(newCustomCards);
          setContextCustomDeclensionCards(newCustomCards);
        });
      } else {
        const newSystemCards = systemDeclensionCards.map((c) =>
          c.id === cardId ? updatedCard : c
        );

        applyOptimisticSystemCards(newSystemCards, async () => {
          await updateDeclensionCardTranslation(cardId as number, word, translation);
          setContextSystemDeclensionCards(newSystemCards);
        });
      }
    },
    [
      allDeclensionCards,
      customDeclensionCards,
      systemDeclensionCards,
      applyOptimisticCustomCards,
      applyOptimisticSystemCards,
      setContextCustomDeclensionCards,
      setContextSystemDeclensionCards,
    ]
  );

  const intervals: DeclensionRatingIntervals = useMemo(() => {
    if (!currentSessionCard) {
      return {
        [Rating.Again]: '',
        [Rating.Hard]: '',
        [Rating.Good]: '',
        [Rating.Easy]: '',
      };
    }
    const allIntervals = getNextIntervals(
      getOrCreateDeclensionCardReviewData(currentSessionCard.card.id, reviewStore).fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const totalRemaining = sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeCard = practiceCards[practiceIndex];

  const canEditCurrentCard = currentSessionCard?.card.isCustom || isAdmin;

  if (contextLoading || !sessionReady) {
    return (
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    );
  }

  return (
    <>
      <DeclensionFilterControls
        caseFilter={caseFilter}
        genderFilter={genderFilter}
        numberFilter={numberFilter}
        practiceMode={practiceMode}
        showSettings={showSettings}
        onCaseChange={handleCaseChange}
        onGenderChange={handleGenderChange}
        onNumberChange={handleNumberChange}
        onTogglePractice={togglePracticeMode}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onAddCard={user ? handleOpenCreateModal : undefined}
      />

      {showSettings && !practiceMode && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
        />
      )}

      <MainContent>
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
            `Practice Mode · ${practiceCards.length} cards`
          ) : isFinished ? null : isPracticeAhead ? (
            <>
              Practice Ahead · <ReviewCountBadge count={totalRemaining} /> remaining
            </>
          ) : (
            <>
              {reviewCount} reviews · {newCount} new · <ReviewCountBadge count={totalRemaining} />{' '}
              remaining
            </>
          )}
        </Typography>

        {practiceMode ? (
          currentPracticeCard ? (
            <DeclensionFlashcard
              key={`practice-${currentPracticeCard.id}-${practiceIndex}`}
              card={currentPracticeCard}
              practiceMode
              isAdmin={isAdmin}
              onNext={handlePracticeNext}
              onUpdateTranslation={
                isAdmin
                  ? (word, translation) =>
                      handleUpdateTranslation(currentPracticeCard.id, word, translation)
                  : undefined
              }
            />
          ) : (
            <EmptyState message="No cards match your filters" />
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
          <DeclensionFlashcard
            key={`${currentSessionCard.card.id}-${ratingCounter}`}
            card={currentSessionCard.card}
            intervals={intervals}
            canEdit={canEditCurrentCard}
            isAdmin={isAdmin}
            onRate={handleRate}
            onEdit={handleOpenEditModal}
            onUpdateTranslation={
              isAdmin
                ? (word, translation) =>
                    handleUpdateTranslation(currentSessionCard.card.id, word, translation)
                : undefined
            }
          />
        ) : null}
      </MainContent>

      <EditDeclensionModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCard(null);
          setIsCreatingNew(false);
        }}
        onSave={handleSaveCard}
        onDelete={editingCard?.isCustom ? handleDeleteCard : undefined}
        card={editingCard}
        isCreating={isCreatingNew}
      />
    </>
  );
}

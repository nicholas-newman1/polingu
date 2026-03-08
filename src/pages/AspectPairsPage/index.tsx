import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography, Stack } from '@mui/material';
import { styled } from '../../lib/styled';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { AspectPairsFlashcard, type RatingIntervals } from './components/AspectPairsFlashcard';
import { FinishedState } from '../../components/FinishedState';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCountBadge } from '../../components/ReviewCountBadge';
import { SettingsPanel } from '../../components/SettingsPanel';
import { EditAspectPairsModal } from '../../components/EditAspectPairsModal';
import type {
  AspectPairCard,
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../types/aspectPairs';
import type { Verb, Aspect, VerbClass } from '../../types/conjugation';
import getOrCreateAspectPairsCardReviewData from '../../lib/storage/getOrCreateAspectPairsCardReviewData';
import getAspectPairsSessionCards from '../../lib/aspectPairsScheduler/getAspectPairsSessionCards';
import getAspectPairsPracticeAheadCards from '../../lib/aspectPairsScheduler/getAspectPairsPracticeAheadCards';
import getAspectPairsExtraNewCards from '../../lib/aspectPairsScheduler/getAspectPairsExtraNewCards';
import rateAspectPairsCard from '../../lib/aspectPairsScheduler/rateAspectPairsCard';
import getNextIntervals from '../../lib/fsrsUtils/getNextIntervals';
import type { AspectPairsSessionCard } from '../../lib/aspectPairsScheduler/types';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useAspectPairs, useConjugation } from '../../hooks/useReviewData';
import { useProgressStats } from '../../hooks/useProgressStats';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useCardHistory } from '../../hooks/useCardHistory';
import shuffleArray from '../../lib/utils/shuffleArray';
import { includesVerbId } from '../../lib/storage/helpers';
import { updateVerb } from '../../lib/storage/systemVerbs';

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

export function AspectPairsPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    aspectPairCards,
    aspectPairsReviewStore: reviewStore,
    aspectPairsSettings: settings,
    updateAspectPairsReviewStore,
    updateAspectPairsSettings,
    clearAspectPairsData,
  } = useAspectPairs();
  const { verbs: contextVerbs, setVerbs: setContextVerbs } = useConjugation();

  const [verbs, applyOptimisticVerbs] = useOptimistic(contextVerbs, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<AspectPairCard | null>(null);

  const [learningQueue, setLearningQueue] = useState<AspectPairsSessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<AspectPairCard[]>([]);
  const [sessionQueue, setSessionQueue] = useState<AspectPairsSessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const sessionBuiltRef = useRef(false);
  const contextLoading = !(aspectPairCards.length > 0 || reviewStore);

  const {
    isViewingHistory,
    historyCard,
    canGoBack,
    addToHistory,
    updateInHistory,
    goBack,
    goForward,
    clearHistory,
  } = useCardHistory<AspectPairCard>();

  const buildSession = useCallback(
    (
      cards: AspectPairCard[],
      store: AspectPairsReviewDataStore,
      currentSettings: AspectPairsSettings
    ) => {
      const { reviewCards, newCards } = getAspectPairsSessionCards(cards, store, currentSettings);
      setSessionQueue([...reviewCards, ...newCards]);
      setReviewCount(reviewCards.length);
      setNewCount(newCards.length);
      setLearningQueue([]);
      setCurrentIndex(0);
      setIsPracticeAhead(false);
      clearHistory();
    },
    [clearHistory]
  );

  useEffect(() => {
    if (!contextLoading && !sessionBuiltRef.current && aspectPairCards.length >= 0) {
      sessionBuiltRef.current = true;
      queueMicrotask(() => {
        buildSession(aspectPairCards, reviewStore, settings);
      });
    }
  }, [contextLoading, buildSession, aspectPairCards, reviewStore, settings]);

  const progressStats = useProgressStats();

  const startPracticeAhead = useCallback(() => {
    const aheadCards = getAspectPairsPracticeAheadCards(
      aspectPairCards,
      reviewStore,
      practiceAheadCount
    );
    setSessionQueue(aheadCards);
    setReviewCount(aheadCards.length);
    setNewCount(0);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(true);
  }, [aspectPairCards, reviewStore, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const extraCards = getAspectPairsExtraNewCards(
      aspectPairCards,
      reviewStore,
      extraNewCardsCount
    );
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [aspectPairCards, reviewStore, extraNewCardsCount]);

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      setPracticeCards(shuffleArray([...aspectPairCards]));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, aspectPairCards]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished = currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    addToHistory(currentSessionCard.card);

    const verbId = currentSessionCard.card.verb.id;
    const updatedReviewData = rateAspectPairsCard(currentSessionCard.reviewData, rating);

    const newStore = { ...reviewStore };
    newStore.cards = { ...newStore.cards };
    newStore.cards[verbId] = updatedReviewData;

    if (currentSessionCard.isNew && !includesVerbId(newStore.newCardsToday, verbId)) {
      newStore.newCardsToday = [...newStore.newCardsToday, verbId];
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
      if (!includesVerbId(newStore.reviewedToday, verbId)) {
        newStore.reviewedToday = [...newStore.reviewedToday, verbId];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setRatingCounter((c) => c + 1);
    await updateAspectPairsReviewStore(newStore);
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    await updateAspectPairsSettings(newSettings);
    buildSession(aspectPairCards, reviewStore, newSettings);
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your aspect pairs progress and cannot be undone.'
      )
    ) {
      await clearAspectPairsData();
      sessionBuiltRef.current = false;
      setShowSettings(false);
    }
  };

  const handleOpenEditModal = useCallback(() => {
    if (!currentSessionCard) return;
    setEditingCard(currentSessionCard.card);
    setShowEditModal(true);
  }, [currentSessionCard]);

  const updateCardInQueues = useCallback(
    (verb1Id: string, verb2Id: string, updatedVerb1: Verb, updatedVerb2: Verb) => {
      const updateCard = (card: AspectPairCard): AspectPairCard => {
        let newCard = card;
        if (card.verb.id === verb1Id) {
          newCard = { ...newCard, verb: updatedVerb1 };
        } else if (card.verb.id === verb2Id) {
          newCard = { ...newCard, verb: updatedVerb2 };
        }
        if (card.pairVerb.id === verb1Id) {
          newCard = { ...newCard, pairVerb: updatedVerb1 };
        } else if (card.pairVerb.id === verb2Id) {
          newCard = { ...newCard, pairVerb: updatedVerb2 };
        }
        return newCard;
      };

      setSessionQueue((prev) => prev.map((item) => ({ ...item, card: updateCard(item.card) })));
      setLearningQueue((prev) => prev.map((item) => ({ ...item, card: updateCard(item.card) })));
      setPracticeCards((prev) => prev.map(updateCard));
      updateInHistory(
        (c) =>
          c.verb.id === verb1Id ||
          c.verb.id === verb2Id ||
          c.pairVerb.id === verb1Id ||
          c.pairVerb.id === verb2Id,
        updateCard
      );
    },
    [updateInHistory]
  );

  const removeCardFromQueues = (verb1Id: string, verb2Id: string) => {
    const shouldRemove = (card: AspectPairCard) =>
      (card.verb.id === verb1Id && card.pairVerb.id === verb2Id) ||
      (card.verb.id === verb2Id && card.pairVerb.id === verb1Id);

    setSessionQueue((prev) => prev.filter((item) => !shouldRemove(item.card)));
    setLearningQueue((prev) => prev.filter((item) => !shouldRemove(item.card)));
    setPracticeCards((prev) => prev.filter((card) => !shouldRemove(card)));
  };

  const handleSaveCard = useCallback(
    (
      verb1Updates: {
        infinitive: string;
        infinitiveEn: string;
        aspect: Aspect;
        verbClass: VerbClass;
      },
      verb2Updates: {
        infinitive: string;
        infinitiveEn: string;
        aspect: Aspect;
        verbClass: VerbClass;
      }
    ) => {
      if (!editingCard) return;

      const verb1 = editingCard.verb;
      const verb2 = editingCard.pairVerb;
      const isBiaspectual = verb1.id === verb2.id;

      const updatedVerb1: Verb = { ...verb1, ...verb1Updates };
      const updatedVerb2: Verb = isBiaspectual ? updatedVerb1 : { ...verb2, ...verb2Updates };

      const newVerbs = verbs.map((v) => {
        if (v.id === verb1.id) return updatedVerb1;
        if (v.id === verb2.id) return updatedVerb2;
        return v;
      });

      updateCardInQueues(verb1.id, verb2.id, updatedVerb1, updatedVerb2);

      applyOptimisticVerbs(newVerbs, async () => {
        await updateVerb(verb1.id, verb1Updates);
        if (!isBiaspectual) {
          await updateVerb(verb2.id, verb2Updates);
        }
        setContextVerbs(newVerbs);
      });
    },
    [editingCard, verbs, applyOptimisticVerbs, setContextVerbs, updateCardInQueues]
  );

  const handleUnlinkPair = useCallback(() => {
    if (!editingCard) return;

    const verb1 = editingCard.verb;
    const verb2 = editingCard.pairVerb;

    if (verb1.id === verb2.id) return; // Can't unlink biaspectual

    const updatedVerb1: Verb = { ...verb1, aspectPair: undefined };
    const updatedVerb2: Verb = { ...verb2, aspectPair: undefined };

    const newVerbs = verbs.map((v) => {
      if (v.id === verb1.id) return updatedVerb1;
      if (v.id === verb2.id) return updatedVerb2;
      return v;
    });

    removeCardFromQueues(verb1.id, verb2.id);

    applyOptimisticVerbs(newVerbs, async () => {
      await updateVerb(verb1.id, { aspectPair: undefined });
      await updateVerb(verb2.id, { aspectPair: undefined });
      setContextVerbs(newVerbs);
    });

    setShowEditModal(false);
    setEditingCard(null);
  }, [editingCard, verbs, applyOptimisticVerbs, setContextVerbs]);

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
      getOrCreateAspectPairsCardReviewData(currentSessionCard.card.verb.id, reviewStore).fsrsCard
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

  const isLoading = contextLoading;

  if (aspectPairCards.length === 0 && !isLoading) {
    return (
      <MainContent>
        <EmptyState message="No aspect pairs available. Verbs need aspectPair data to practice." />
      </MainContent>
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
      </ControlsRow>

      {showSettings && !practiceMode && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel="Reset Aspect Pairs Progress"
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
                `Practice Mode · ${practiceCards.length} pairs`
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
              currentPracticeCard ? (
                <AspectPairsFlashcard
                  key={`practice-${currentPracticeCard.verb.id}-${practiceIndex}`}
                  card={currentPracticeCard}
                  practiceMode
                  canEdit={isAdmin}
                  onNext={handlePracticeNext}
                  onEdit={() => {
                    setEditingCard(currentPracticeCard);
                    setShowEditModal(true);
                  }}
                  onUnlink={() => {
                    const verb1 = currentPracticeCard.verb;
                    const verb2 = currentPracticeCard.pairVerb;
                    if (verb1.id === verb2.id) return;
                    const updatedVerb1: Verb = { ...verb1, aspectPair: undefined };
                    const updatedVerb2: Verb = { ...verb2, aspectPair: undefined };
                    const newVerbs = verbs.map((v) => {
                      if (v.id === verb1.id) return updatedVerb1;
                      if (v.id === verb2.id) return updatedVerb2;
                      return v;
                    });
                    removeCardFromQueues(verb1.id, verb2.id);
                    applyOptimisticVerbs(newVerbs, async () => {
                      await updateVerb(verb1.id, { aspectPair: undefined });
                      await updateVerb(verb2.id, { aspectPair: undefined });
                      setContextVerbs(newVerbs);
                    });
                    handlePracticeNext();
                  }}
                />
              ) : (
                <EmptyState message="No aspect pairs available" />
              )
            ) : isViewingHistory && historyCard ? (
              <AspectPairsFlashcard
                key={`history-${historyCard.verb.id}`}
                card={historyCard}
                isViewingHistory
                canGoBack={canGoBack}
                canEdit={isAdmin}
                onGoBack={goBack}
                onContinue={goForward}
                onEdit={() => {
                  setEditingCard(historyCard);
                  setShowEditModal(true);
                }}
                onUnlink={() => {
                  const verb1 = historyCard.verb;
                  const verb2 = historyCard.pairVerb;
                  if (verb1.id === verb2.id) return;
                  const updatedVerb1: Verb = { ...verb1, aspectPair: undefined };
                  const updatedVerb2: Verb = { ...verb2, aspectPair: undefined };
                  const newVerbs = verbs.map((v) => {
                    if (v.id === verb1.id) return updatedVerb1;
                    if (v.id === verb2.id) return updatedVerb2;
                    return v;
                  });
                  removeCardFromQueues(verb1.id, verb2.id);
                  applyOptimisticVerbs(newVerbs, async () => {
                    await updateVerb(verb1.id, { aspectPair: undefined });
                    await updateVerb(verb2.id, { aspectPair: undefined });
                    setContextVerbs(newVerbs);
                  });
                  goForward();
                }}
              />
            ) : isFinished ? (
              <FinishedState
                currentFeature="aspectPairs"
                otherFeaturesDue={[
                  {
                    feature: 'vocabulary',
                    label: 'Vocabulary',
                    dueCount: progressStats.vocabulary.due,
                    path: '/vocabulary',
                  },
                  {
                    feature: 'declension',
                    label: 'Declension',
                    dueCount: progressStats.declension.due,
                    path: '/declension',
                  },
                  {
                    feature: 'conjugation',
                    label: 'Conjugation',
                    dueCount: progressStats.conjugation.due,
                    path: '/conjugation',
                  },
                  {
                    feature: 'sentences',
                    label: 'Sentences',
                    dueCount: progressStats.sentences.due,
                    path: '/sentences',
                  },
                ]}
                onNavigateToFeature={(path) => navigate(path)}
                practiceAheadCount={practiceAheadCount}
                setPracticeAheadCount={setPracticeAheadCount}
                extraNewCardsCount={extraNewCardsCount}
                setExtraNewCardsCount={setExtraNewCardsCount}
                onPracticeAhead={startPracticeAhead}
                onLearnExtra={startExtraNewCards}
              />
            ) : currentSessionCard ? (
              <AspectPairsFlashcard
                key={`${currentSessionCard.card.verb.id}-${ratingCounter}`}
                card={currentSessionCard.card}
                intervals={intervals}
                canGoBack={canGoBack}
                canEdit={isAdmin}
                onRate={handleRate}
                onGoBack={goBack}
                onEdit={handleOpenEditModal}
                onUnlink={handleUnlinkPair}
              />
            ) : null}
          </>
        )}
      </MainContent>

      <EditAspectPairsModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        onUnlink={isAdmin ? handleUnlinkPair : undefined}
        card={editingCard}
      />
    </>
  );
}

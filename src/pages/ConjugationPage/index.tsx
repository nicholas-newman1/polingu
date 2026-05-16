import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rating, type Grade } from 'ts-fsrs';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '../../lib/styled';
import {
  ConjugationFlashcard,
  type ConjugationRatingIntervals,
} from './components/ConjugationFlashcard';
import { ConjugationModeSelector } from './components/ConjugationModeSelector';
import { ConjugationFilterControls } from './components/ConjugationFilterControls';
import { FinishedState } from '../../components/FinishedState';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCountBadge } from '../../components/ReviewCountBadge';
import { SettingsPanel } from '../../components/SettingsPanel';
import { EditConjugationModal } from '../../components/EditConjugationModal';
import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationDirectionSettings,
  ConjugationFilters,
  ConjugationFormReviewData,
  DrillableForm,
  ConjugationForm,
  Aspect,
  VerbClass,
} from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { DEFAULT_CONJUGATION_SETTINGS } from '../../types/conjugation';
import getOrCreateConjugationFormReviewData from '../../lib/storage/getOrCreateConjugationFormReviewData';
import getConjugationSessionCards from '../../lib/conjugationScheduler/getConjugationSessionCards';
import getConjugationPracticeAheadCards from '../../lib/conjugationScheduler/getConjugationPracticeAheadCards';
import getConjugationExtraNewCards from '../../lib/conjugationScheduler/getConjugationExtraNewCards';
import rateConjugationCard from '../../lib/conjugationScheduler/rateConjugationCard';
import getNextIntervals from '../../lib/fsrsUtils/getNextIntervals';
import type { ConjugationSessionCard } from '../../lib/conjugationScheduler/types';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useReviewData } from '../../hooks/useReviewData';
import { useProgressStats } from '../../hooks/useProgressStats';
import shuffleArray from '../../lib/utils/shuffleArray';
import { includesFormKey } from '../../lib/storage/helpers';
import {
  getDrillableFormsForVerb,
  matchesFilters,
  getDefaultFilters,
} from '../../lib/conjugationUtils';
import { useUserFilters } from '../../contexts/UserFiltersContext';
import { updateVerb, deleteVerb } from '../../lib/storage/systemVerbs';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useCardHistory } from '../../hooks/useCardHistory';
import { usePrefetchAudio } from '../../hooks/usePrefetchAudio';

const MainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

interface ConjugationPageProps {
  mode?: TranslationDirection;
}

export function ConjugationPage({ mode }: ConjugationPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    loading: contextLoading,
    conjugationReviewStores,
    conjugationSettings: settings,
    verbs: contextVerbs,
    updateConjugationReviewStore,
    updateConjugationSettings,
    clearConjugationReviewData,
    setVerbs: setContextVerbs,
  } = useReviewData();

  const [verbs, applyOptimisticVerbs] = useOptimistic(contextVerbs, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const { filters: userFilters, filtersLoading, updateConjugationFilters } = useUserFilters();
  const filters = userFilters.conjugation;

  const [showSettings, setShowSettings] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingForm, setEditingForm] = useState<DrillableForm | null>(null);

  const [learningQueue, setLearningQueue] = useState<ConjugationSessionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCards, setPracticeCards] = useState<DrillableForm[]>([]);
  const [sessionQueue, setSessionQueue] = useState<ConjugationSessionCard[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [ratingCounter, setRatingCounter] = useState(0);
  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [isPracticeAhead, setIsPracticeAhead] = useState(false);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const sessionBuiltRef = useRef(false);
  const currentDirection = mode ?? 'pl-to-en';
  const directionRef = useRef(currentDirection);

  const {
    isViewingHistory,
    historyCard,
    historyMeta,
    canGoBack,
    addToHistory,
    updateInHistory,
    goBack,
    goForward,
    clearHistory,
  } = useCardHistory<DrillableForm, ConjugationFormReviewData>();

  const directionSettings = settings[currentDirection];
  const reviewStore = conjugationReviewStores[currentDirection];

  const progressStats = useProgressStats();
  const modeStats = {
    'pl-to-en': {
      dueCount: progressStats.conjugationByDirection?.['pl-to-en']?.due ?? 0,
      learnedCount: progressStats.conjugationByDirection?.['pl-to-en']?.learned ?? 0,
      totalCount: progressStats.conjugationByDirection?.['pl-to-en']?.total ?? 0,
    },
    'en-to-pl': {
      dueCount: progressStats.conjugationByDirection?.['en-to-pl']?.due ?? 0,
      learnedCount: progressStats.conjugationByDirection?.['en-to-pl']?.learned ?? 0,
      totalCount: progressStats.conjugationByDirection?.['en-to-pl']?.total ?? 0,
    },
  };

  const verbsById = useMemo(() => {
    const map = new Map<string, Verb>();
    for (const verb of verbs) {
      map.set(verb.id, verb);
    }
    return map;
  }, [verbs]);

  const buildSession = useCallback(
    (
      allVerbs: Verb[],
      store: ConjugationReviewDataStore,
      currentSettings: ConjugationDirectionSettings,
      currentFilters: ConjugationFilters
    ) => {
      const { reviewCards, newCards } = getConjugationSessionCards(
        allVerbs,
        store,
        currentFilters,
        currentSettings
      );
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
    if (!contextLoading && !filtersLoading && !sessionBuiltRef.current && verbs.length > 0) {
      sessionBuiltRef.current = true;
      directionRef.current = currentDirection;
      queueMicrotask(() => {
        buildSession(verbs, reviewStore, directionSettings, filters);
      });
    }
  }, [
    contextLoading,
    filtersLoading,
    buildSession,
    verbs,
    reviewStore,
    directionSettings,
    currentDirection,
    filters,
  ]);

  const handleSelectMode = useCallback(
    (direction: TranslationDirection) => {
      const route = direction === 'pl-to-en' ? 'recognition' : 'production';
      navigate(`/conjugation/${route}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (!mode || contextLoading) return;

    if (directionRef.current !== mode) {
      directionRef.current = mode;
      const modeSettings = settings[mode];
      const modeReviewStore = conjugationReviewStores[mode];
      queueMicrotask(() => {
        buildSession(verbs, modeReviewStore, modeSettings, filters);
      });
    }
  }, [mode, contextLoading, settings, conjugationReviewStores, verbs, buildSession, filters]);

  const startPracticeAhead = useCallback(() => {
    const aheadCards = getConjugationPracticeAheadCards(
      verbs,
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
  }, [verbs, reviewStore, filters, practiceAheadCount]);

  const startExtraNewCards = useCallback(() => {
    const extraCards = getConjugationExtraNewCards(verbs, reviewStore, filters, extraNewCardsCount);
    setSessionQueue(extraCards);
    setReviewCount(0);
    setNewCount(extraCards.length);
    setLearningQueue([]);
    setCurrentIndex(0);
    setIsPracticeAhead(false);
  }, [verbs, reviewStore, filters, extraNewCardsCount]);

  const togglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      const allForms: DrillableForm[] = [];
      for (const verb of verbs) {
        const forms = getDrillableFormsForVerb(verb);
        for (const form of forms) {
          if (matchesFilters(form, filters)) {
            allForms.push(form);
          }
        }
      }
      setPracticeCards(shuffleArray(allForms));
      setPracticeIndex(0);
    }
    setPracticeMode(!practiceMode);
  }, [practiceMode, verbs, filters]);

  const handlePracticeNext = useCallback(() => {
    setPracticeIndex((prev) => (prev + 1) % practiceCards.length);
  }, [practiceCards.length]);

  const currentSessionCard = sessionQueue[currentIndex] ?? learningQueue[0];
  const isFinished = currentIndex >= sessionQueue.length && learningQueue.length === 0;

  const upcomingAudioUrls = practiceMode
    ? Array.from({ length: 3 }, (_, i) => {
        const len = practiceCards.length;
        if (len === 0) return undefined;
        return practiceCards[(practiceIndex + 1 + i) % len]?.form.audioUrl;
      })
    : [
        ...sessionQueue
          .slice(currentIndex + 1, currentIndex + 4)
          .map((c) => c.form.form.audioUrl),
        ...learningQueue
          .slice(currentIndex < sessionQueue.length ? 0 : 1)
          .map((c) => c.form.form.audioUrl),
      ].slice(0, 3);
  usePrefetchAudio(upcomingAudioUrls);

  const handleRate = async (rating: Grade) => {
    if (!currentSessionCard) return;

    addToHistory(currentSessionCard.form, currentSessionCard.reviewData);

    const formKey = currentSessionCard.form.fullFormKey;
    const updatedReviewData = rateConjugationCard(currentSessionCard.reviewData, rating);

    const newStore = { ...reviewStore };
    newStore.forms = { ...newStore.forms };
    newStore.forms[formKey] = updatedReviewData;

    if (currentSessionCard.isNew && !includesFormKey(newStore.newFormsToday, formKey)) {
      newStore.newFormsToday = [...newStore.newFormsToday, formKey];
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
      if (!includesFormKey(newStore.reviewedToday, formKey)) {
        newStore.reviewedToday = [...newStore.reviewedToday, formKey];
      }

      if (currentIndex < sessionQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLearningQueue((prev) => prev.slice(1));
      }
    }

    setRatingCounter((c) => c + 1);
    await updateConjugationReviewStore(directionRef.current, newStore);
  };

  const handleReassess = async (rating: Grade) => {
    if (!historyCard || !historyMeta) return;

    const formKey = historyCard.fullFormKey;
    const updatedReviewData = rateConjugationCard(historyMeta, rating);

    const newStore = { ...reviewStore };
    newStore.forms = { ...newStore.forms, [formKey]: updatedReviewData };

    await updateConjugationReviewStore(directionRef.current, newStore);
    goForward();
  };

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateConjugationSettings(currentDirection, newSettings);
    buildSession(verbs, reviewStore, newSettings, filters);
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your conjugation progress for this direction and cannot be undone.'
      )
    ) {
      await clearConjugationReviewData(currentDirection);
      const freshStore = conjugationReviewStores[currentDirection];
      buildSession(verbs, freshStore, DEFAULT_CONJUGATION_SETTINGS[currentDirection], filters);
      setShowSettings(false);
    }
  };

  const handleFilterChange = useCallback(
    (newFilters: ConjugationFilters) => {
      updateConjugationFilters(newFilters);
      if (practiceMode) {
        const allForms: DrillableForm[] = [];
        for (const verb of verbs) {
          const forms = getDrillableFormsForVerb(verb);
          for (const form of forms) {
            if (matchesFilters(form, newFilters)) {
              allForms.push(form);
            }
          }
        }
        setPracticeCards(shuffleArray(allForms));
        setPracticeIndex(0);
      } else {
        buildSession(verbs, reviewStore, directionSettings, newFilters);
      }
    },
    [verbs, practiceMode, buildSession, reviewStore, directionSettings, updateConjugationFilters]
  );

  const handleOpenEditModal = useCallback(() => {
    if (!currentSessionCard) return;
    setEditingForm(currentSessionCard.form);
    setShowEditModal(true);
  }, [currentSessionCard]);

  const updateFormInQueues = useCallback(
    (verbId: string, updatedVerb: Verb) => {
      setSessionQueue((prev) =>
        prev.map((item) => {
          if (item.form.verb.id === verbId) {
            const updatedForms = getDrillableFormsForVerb(updatedVerb);
            const matchingForm = updatedForms.find((f) => f.fullFormKey === item.form.fullFormKey);
            if (matchingForm) {
              return { ...item, form: matchingForm };
            }
          }
          return item;
        })
      );
      setLearningQueue((prev) =>
        prev.map((item) => {
          if (item.form.verb.id === verbId) {
            const updatedForms = getDrillableFormsForVerb(updatedVerb);
            const matchingForm = updatedForms.find((f) => f.fullFormKey === item.form.fullFormKey);
            if (matchingForm) {
              return { ...item, form: matchingForm };
            }
          }
          return item;
        })
      );
      setPracticeCards((prev) =>
        prev.map((form) => {
          if (form.verb.id === verbId) {
            const updatedForms = getDrillableFormsForVerb(updatedVerb);
            const matchingForm = updatedForms.find((f) => f.fullFormKey === form.fullFormKey);
            return matchingForm || form;
          }
          return form;
        })
      );
      updateInHistory(
        (form) => form.verb.id === verbId,
        (form) => {
          const updatedForms = getDrillableFormsForVerb(updatedVerb);
          return updatedForms.find((f) => f.fullFormKey === form.fullFormKey) || form;
        }
      );
    },
    [updateInHistory]
  );

  const removeVerbFromQueues = (verbId: string) => {
    setSessionQueue((prev) => prev.filter((item) => item.form.verb.id !== verbId));
    setLearningQueue((prev) => prev.filter((item) => item.form.verb.id !== verbId));
    setPracticeCards((prev) => prev.filter((form) => form.verb.id !== verbId));
  };

  const handleSaveForm = useCallback(
    (
      verbUpdates: {
        infinitive: string;
        infinitiveEn: string;
        aspect: Aspect;
        verbClass: VerbClass;
        isReflexive: boolean;
      },
      formUpdates: ConjugationForm
    ) => {
      if (!editingForm) return;

      const verb = editingForm.verb;
      const tense = editingForm.tense;
      const formKey = editingForm.formKey;

      // Build the updated conjugations
      const updatedConjugations = { ...verb.conjugations };
      const currentTenseForms = updatedConjugations[tense];
      if (currentTenseForms) {
        (updatedConjugations[tense] as typeof currentTenseForms) = {
          ...currentTenseForms,
          [formKey]: {
            ...(currentTenseForms as Record<string, ConjugationForm>)[formKey],
            ...formUpdates,
          },
        };
      }

      const updatedVerb: Verb = {
        ...verb,
        ...verbUpdates,
        conjugations: updatedConjugations,
      };

      const newVerbs = verbs.map((v) => (v.id === verb.id ? updatedVerb : v));

      updateFormInQueues(verb.id, updatedVerb);

      applyOptimisticVerbs(newVerbs, async () => {
        await updateVerb(verb.id, {
          ...verbUpdates,
          conjugations: updatedConjugations,
        });
        setContextVerbs(newVerbs);
      });
    },
    [editingForm, verbs, applyOptimisticVerbs, setContextVerbs, updateFormInQueues]
  );

  const deleteVerbById = useCallback(
    (verbId: string, { skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
      if (!skipConfirm) {
        const confirmMessage =
          'Are you sure you want to delete this verb? This will remove all conjugation forms for this verb and affect all users.';
        if (!window.confirm(confirmMessage)) return;
      }

      const newVerbs = verbs.filter((v) => v.id !== verbId);
      removeVerbFromQueues(verbId);
      applyOptimisticVerbs(newVerbs, async () => {
        await deleteVerb(verbId);
        setContextVerbs(newVerbs);
      });
    },
    [verbs, applyOptimisticVerbs, setContextVerbs]
  );

  const handleDeleteVerb = useCallback(() => {
    if (!editingForm) return;
    deleteVerbById(editingForm.verb.id, { skipConfirm: true });
    setShowEditModal(false);
    setEditingForm(null);
  }, [editingForm, deleteVerbById]);

  const handleDeleteCurrentSessionVerb = useCallback(() => {
    if (!currentSessionCard) return;
    deleteVerbById(currentSessionCard.form.verb.id);
  }, [currentSessionCard, deleteVerbById]);

  const intervals: ConjugationRatingIntervals = useMemo(() => {
    if (!currentSessionCard) {
      return {
        [Rating.Again]: '',
        [Rating.Hard]: '',
        [Rating.Good]: '',
        [Rating.Easy]: '',
      };
    }
    const allIntervals = getNextIntervals(
      getOrCreateConjugationFormReviewData(currentSessionCard.form.fullFormKey, reviewStore)
        .fsrsCard
    );
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [currentSessionCard, reviewStore]);

  const reassessIntervals: ConjugationRatingIntervals | undefined = useMemo(() => {
    if (!historyMeta) return undefined;
    const allIntervals = getNextIntervals(historyMeta.fsrsCard);
    return {
      [Rating.Again]: allIntervals[Rating.Again],
      [Rating.Hard]: allIntervals[Rating.Hard],
      [Rating.Good]: allIntervals[Rating.Good],
      [Rating.Easy]: allIntervals[Rating.Easy],
    };
  }, [historyMeta]);

  const totalRemaining = sessionQueue.length - currentIndex + learningQueue.length;

  const currentPracticeForm = practiceCards[practiceIndex];

  const isLoading = contextLoading || filtersLoading;

  const getAspectPairVerb = (form: DrillableForm): Verb | undefined => {
    if (!form.verb.aspectPair) return undefined;
    return verbsById.get(form.verb.aspectPair);
  };

  if (!mode) {
    return (
      <ConjugationModeSelector
        stats={modeStats}
        loading={contextLoading}
        onSelectMode={handleSelectMode}
      />
    );
  }

  return (
    <>
      <ConjugationFilterControls
        tenseFilter={filters.tenses}
        personFilter={filters.persons}
        numberFilter={filters.number}
        aspectFilter={filters.aspects}
        verbClassFilter={filters.verbClasses}
        genderFilter={filters.genders}
        practiceMode={practiceMode}
        showSettings={showSettings}
        onTenseChange={(value) => handleFilterChange({ ...filters, tenses: value })}
        onPersonChange={(value) => handleFilterChange({ ...filters, persons: value })}
        onNumberChange={(value) => handleFilterChange({ ...filters, number: value })}
        onAspectChange={(value) => handleFilterChange({ ...filters, aspects: value })}
        onVerbClassChange={(value) => handleFilterChange({ ...filters, verbClasses: value })}
        onGenderChange={(value) => handleFilterChange({ ...filters, genders: value })}
        onClearFilters={() => handleFilterChange(getDefaultFilters())}
        onTogglePractice={togglePracticeMode}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />

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
                `Drill Mode · ${practiceCards.length} forms`
              ) : isFinished ? null : isPracticeAhead ? (
                <>
                  Drill Ahead · <ReviewCountBadge count={totalRemaining} /> remaining
                </>
              ) : (
                <>
                  {reviewCount} reviews · {newCount} new ·{' '}
                  <ReviewCountBadge count={totalRemaining} /> remaining
                </>
              )}
            </Typography>

            {practiceMode ? (
              currentPracticeForm ? (
                <ConjugationFlashcard
                  key={`practice-${currentPracticeForm.fullFormKey}-${practiceIndex}`}
                  form={currentPracticeForm}
                  direction={currentDirection}
                  aspectPairVerb={getAspectPairVerb(currentPracticeForm)}
                  practiceMode
                  canEdit={isAdmin}
                  onNext={handlePracticeNext}
                  onEdit={() => {
                    setEditingForm(currentPracticeForm);
                    setShowEditModal(true);
                  }}
                  onDelete={() => {
                    deleteVerbById(currentPracticeForm.verb.id);
                    handlePracticeNext();
                  }}
                />
              ) : (
                <EmptyState message="No forms match your filters" />
              )
            ) : isViewingHistory && historyCard ? (
              <ConjugationFlashcard
                key={`history-${historyCard.fullFormKey}`}
                form={historyCard}
                direction={currentDirection}
                aspectPairVerb={getAspectPairVerb(historyCard)}
                isViewingHistory
                canGoBack={canGoBack}
                canEdit={isAdmin}
                reassessIntervals={reassessIntervals}
                onGoBack={goBack}
                onContinue={goForward}
                onReassess={handleReassess}
                onEdit={() => {
                  setEditingForm(historyCard);
                  setShowEditModal(true);
                }}
                onDelete={() => {
                  deleteVerbById(historyCard.verb.id);
                  goForward();
                }}
              />
            ) : isFinished ? (
              <FinishedState
                currentFeature="conjugation"
                currentDirection={currentDirection}
                otherDirectionDueCount={
                  currentDirection === 'pl-to-en'
                    ? progressStats.conjugationByDirection['en-to-pl'].due
                    : progressStats.conjugationByDirection['pl-to-en'].due
                }
                otherDirectionLabel={currentDirection === 'pl-to-en' ? 'Production' : 'Recognition'}
                onSwitchDirection={() => {
                  const route = currentDirection === 'pl-to-en' ? 'production' : 'recognition';
                  navigate(`/conjugation/${route}`);
                }}
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
                    feature: 'sentences',
                    label: 'Sentences',
                    dueCount: progressStats.sentences.due,
                    path: '/sentences',
                  },
                  {
                    feature: 'aspectPairs',
                    label: 'Aspect Pairs',
                    dueCount: progressStats.aspectPairs.due,
                    path: '/aspect-pairs',
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
              <ConjugationFlashcard
                key={`${currentSessionCard.form.fullFormKey}-${ratingCounter}`}
                form={currentSessionCard.form}
                direction={currentDirection}
                aspectPairVerb={getAspectPairVerb(currentSessionCard.form)}
                intervals={intervals}
                canGoBack={canGoBack}
                canEdit={isAdmin}
                onRate={handleRate}
                onGoBack={goBack}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteCurrentSessionVerb}
              />
            ) : verbs.length === 0 ? (
              <EmptyState message="No verbs available. Import verbs to get started." />
            ) : null}
          </>
        )}
      </MainContent>

      <EditConjugationModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingForm(null);
        }}
        onSave={handleSaveForm}
        onDelete={isAdmin ? handleDeleteVerb : undefined}
        form={editingForm}
      />
    </>
  );
}

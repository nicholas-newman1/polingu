import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { ConjugationFlashcard } from './components/ConjugationFlashcard';
import { ConjugationModeSelector } from './components/ConjugationModeSelector';
import { ConjugationFilterControls } from './components/ConjugationFilterControls';
import { FinishedState } from '../../components/FinishedState';
import { EmptyState } from '../../components/EmptyState';
import { ReviewStage } from '../../components/ReviewStage';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SessionStatusLine } from '../../components/SessionStatusLine';
import { ReviewMainContent } from '../../components/ReviewLayout';
import { EditConjugationModal } from '../../components/EditConjugationModal';
import type {
  Verb,
  ConjugationFilters,
  DrillableForm,
  ConjugationForm,
  Aspect,
  VerbClass,
} from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import getConjugationSessionCards from '../../lib/conjugationScheduler/getConjugationSessionCards';
import getConjugationExtraCards from '../../lib/conjugationScheduler/getConjugationExtraCards';
import { recordFormReview } from '../../lib/reviewSession/recordReview';
import { DIRECTION_ROUTES, otherDirection, toModeStats } from '../../lib/reviewSession/directions';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useReviewData } from '../../hooks/useReviewData';
import { useProgressStats } from '../../hooks/useProgressStats';
import {
  getDrillableFormsForVerb,
  matchesFilters,
  getDefaultFilters,
} from '../../lib/conjugationUtils';
import { useUserFilters } from '../../contexts/UserFiltersContext';
import { updateVerb, deleteVerb } from '../../lib/storage/systemVerbs';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useReviewSession } from '../../hooks/useReviewSession';

function getFilteredForms(verbs: Verb[], filters: ConjugationFilters): DrillableForm[] {
  return verbs.flatMap((verb) =>
    getDrillableFormsForVerb(verb).filter((form) => matchesFilters(form, filters))
  );
}

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingForm, setEditingForm] = useState<DrillableForm | null>(null);

  const currentDirection = mode ?? 'pl-to-en';
  const directionSettings = settings[currentDirection];
  const reviewStore = conjugationReviewStores[currentDirection];

  const session = useReviewSession({
    cardKey: 'form',
    getId: (form) => form.fullFormKey,
    getAudioUrls: (form) => [form.form.audioUrl],
    ready: !contextLoading && !filtersLoading && verbs.length > 0,
    sessionKey: currentDirection,
    getSessionCards: () =>
      getConjugationSessionCards(verbs, reviewStore, filters, directionSettings),
    ...getConjugationExtraCards(verbs, reviewStore, filters),
    reviewStore,
    recordReview: recordFormReview,
    saveReviewStore: (store) => updateConjugationReviewStore(currentDirection, store),
  });
  const { practice, history } = session;
  const { canGoBack, goBack, goForward } = history;

  const progressStats = useProgressStats();
  const modeStats = toModeStats(progressStats.conjugationByDirection);

  const verbsById = useMemo(() => {
    const map = new Map<string, Verb>();
    for (const verb of verbs) {
      map.set(verb.id, verb);
    }
    return map;
  }, [verbs]);

  const handleSelectMode = useCallback(
    (direction: TranslationDirection) =>
      navigate(`/conjugation/${DIRECTION_ROUTES[direction].route}`),
    [navigate]
  );

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateConjugationSettings(currentDirection, newSettings);
    session.startSession(getConjugationSessionCards(verbs, reviewStore, filters, newSettings));
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your conjugation progress for this direction and cannot be undone.'
      )
    ) {
      await clearConjugationReviewData(currentDirection);
      session.rebuildSession();
      setShowSettings(false);
    }
  };

  const handleFilterChange = (newFilters: ConjugationFilters) => {
    updateConjugationFilters(newFilters);
    if (practice.active) {
      practice.reshuffle(getFilteredForms(verbs, newFilters));
    } else {
      session.startSession(
        getConjugationSessionCards(verbs, reviewStore, newFilters, directionSettings)
      );
    }
  };

  const openEditModal = (form: DrillableForm) => {
    setEditingForm(form);
    setShowEditModal(true);
  };

  const replaceVerbInForms = (updatedVerb: Verb) => {
    const updatedForms = getDrillableFormsForVerb(updatedVerb);
    session.updateCards(
      (form) => form.verb.id === updatedVerb.id,
      (form) => updatedForms.find((f) => f.fullFormKey === form.fullFormKey) ?? form
    );
  };

  const withUpdatedForm = (form: DrillableForm, updates: Partial<ConjugationForm>) => {
    const { verb, tense, formKey } = form;
    const tenseForms = verb.conjugations[tense] as Record<string, ConjugationForm> | undefined;
    if (!tenseForms) return verb.conjugations;
    return {
      ...verb.conjugations,
      [tense]: { ...tenseForms, [formKey]: { ...tenseForms[formKey], ...updates } },
    };
  };

  const handleSaveForm = (
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
    const updatedConjugations = withUpdatedForm(editingForm, formUpdates);
    const updatedVerb: Verb = { ...verb, ...verbUpdates, conjugations: updatedConjugations };
    const newVerbs = verbs.map((v) => (v.id === verb.id ? updatedVerb : v));

    replaceVerbInForms(updatedVerb);

    applyOptimisticVerbs(newVerbs, async () => {
      await updateVerb(verb.id, { ...verbUpdates, conjugations: updatedConjugations });
      setContextVerbs(newVerbs);
    });
  };

  const deleteVerbById = (
    verbId: string,
    { skipConfirm = false }: { skipConfirm?: boolean } = {}
  ): boolean => {
    if (
      !skipConfirm &&
      !window.confirm(
        'Are you sure you want to delete this verb? This will remove all conjugation forms for this verb and affect all users.'
      )
    ) {
      return false;
    }

    const newVerbs = verbs.filter((v) => v.id !== verbId);
    session.removeCards((form) => form.verb.id === verbId);
    applyOptimisticVerbs(newVerbs, async () => {
      await deleteVerb(verbId);
      setContextVerbs(newVerbs);
    });
    return true;
  };

  const handleDeleteEditingVerb = () => {
    if (!editingForm) return;
    deleteVerbById(editingForm.verb.id, { skipConfirm: true });
    setShowEditModal(false);
    setEditingForm(null);
  };

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
        practiceMode={practice.active}
        showSettings={showSettings}
        onTenseChange={(value) => handleFilterChange({ ...filters, tenses: value })}
        onPersonChange={(value) => handleFilterChange({ ...filters, persons: value })}
        onNumberChange={(value) => handleFilterChange({ ...filters, number: value })}
        onAspectChange={(value) => handleFilterChange({ ...filters, aspects: value })}
        onVerbClassChange={(value) => handleFilterChange({ ...filters, verbClasses: value })}
        onGenderChange={(value) => handleFilterChange({ ...filters, genders: value })}
        onClearFilters={() => handleFilterChange(getDefaultFilters())}
        onTogglePractice={() => practice.toggle(getFilteredForms(verbs, filters))}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />

      {showSettings && !practice.active && (
        <SettingsPanel
          newCardsPerDay={directionSettings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${currentDirection === 'pl-to-en' ? 'PL→EN' : 'EN→PL'} Progress`}
        />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <>
            <SessionStatusLine session={session} unitLabel="forms" />

            <ReviewStage
              session={session}
              practiceEmptyMessage="No forms match your filters"
              renderPractice={(form) => (
                <ConjugationFlashcard
                  key={`practice-${form.fullFormKey}-${practice.index}`}
                  form={form}
                  direction={currentDirection}
                  aspectPairVerb={getAspectPairVerb(form)}
                  practiceMode
                  canEdit={isAdmin}
                  onNext={practice.next}
                  onEdit={() => openEditModal(form)}
                  onDelete={() => deleteVerbById(form.verb.id)}
                />
              )}
              renderHistory={(form) => (
                <ConjugationFlashcard
                  key={`history-${form.fullFormKey}`}
                  form={form}
                  direction={currentDirection}
                  aspectPairVerb={getAspectPairVerb(form)}
                  isViewingHistory
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  reassessIntervals={session.reassessIntervals}
                  onGoBack={goBack}
                  onContinue={goForward}
                  onReassess={session.reassess}
                  onEdit={() => openEditModal(form)}
                  onDelete={() => {
                    if (deleteVerbById(form.verb.id)) goForward();
                  }}
                />
              )}
              renderFinished={() => (
                <FinishedState
                  currentFeature="conjugation"
                  currentDirection={currentDirection}
                  otherDirectionDueCount={
                    progressStats.conjugationByDirection[otherDirection(currentDirection)].due
                  }
                  otherDirectionLabel={DIRECTION_ROUTES[otherDirection(currentDirection)].label}
                  onSwitchDirection={() => handleSelectMode(otherDirection(currentDirection))}
                  {...session.finishedStateProps}
                />
              )}
              renderCurrent={({ form }) => (
                <ConjugationFlashcard
                  key={`${form.fullFormKey}-${session.ratingCounter}`}
                  form={form}
                  direction={currentDirection}
                  aspectPairVerb={getAspectPairVerb(form)}
                  intervals={session.intervals}
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  onRate={session.rate}
                  onGoBack={goBack}
                  onEdit={() => openEditModal(form)}
                  onDelete={() => deleteVerbById(form.verb.id)}
                />
              )}
              fallback={
                verbs.length === 0 && (
                  <EmptyState message="No verbs available. Import verbs to get started." />
                )
              }
            />
          </>
        )}
      </ReviewMainContent>

      <EditConjugationModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingForm(null);
        }}
        onSave={handleSaveForm}
        onDelete={isAdmin ? handleDeleteEditingVerb : undefined}
        form={editingForm}
        onAudioUpdated={(audioUrl) => {
          if (!editingForm) return;
          const conjugations = withUpdatedForm(editingForm, { audioUrl });
          replaceVerbInForms({ ...editingForm.verb, conjugations });
        }}
      />
    </>
  );
}

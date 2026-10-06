import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Stack } from '@mui/material';
import { AddButton } from '../../components/AddButton';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { ListenButton } from '../../components/ListenButton';
import { useListening } from '../../contexts/ListeningContext';
import { buildSentenceListeningQueue } from '../../lib/listeningScheduler';
import { SentenceFlashcard } from './components/SentenceFlashcard';
import { SentenceModeSelector } from './components/SentenceModeSelector';
import { FinishedState } from '../../components/FinishedState';
import { ReviewStage } from '../../components/ReviewStage';
import { SessionStatusLine } from '../../components/SessionStatusLine';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { SentenceSettingsPanel, LevelChip } from './components/SentenceSettingsPanel';
import { EditSentenceModal } from '../../components/EditSentenceModal';
import type { Sentence, CustomSentence, CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import getSentenceSessionCards from '../../lib/sentenceScheduler/getSentenceSessionCards';
import getSentencePracticeAheadCards from '../../lib/sentenceScheduler/getSentencePracticeAheadCards';
import getSentenceExtraNewCards from '../../lib/sentenceScheduler/getSentenceExtraNewCards';
import { recordCardReview } from '../../lib/reviewSession/recordReview';
import { DIRECTION_ROUTES, otherDirection } from '../../lib/reviewSession/directions';
import toggleInArray from '../../lib/utils/toggleInArray';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useReviewData } from '../../hooks/useReviewData';
import { useProgressStats } from '../../hooks/useProgressStats';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { useReviewSession } from '../../hooks/useReviewSession';
import {
  updateSentence,
  deleteSentence,
  updateSentenceTranslation,
} from '../../lib/storage/systemSentences';
import { saveCustomSentences } from '../../lib/storage/customSentences';

const filterByLevels = (sentences: Sentence[], levels: CEFRLevel[]) =>
  sentences.filter((s) => levels.includes(s.level));

interface SentencesPageProps {
  mode?: TranslationDirection;
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
    setSystemSentences: setContextSystemSentences,
    setCustomSentences: setContextCustomSentences,
  } = useReviewData();

  const [sentences, applyOptimisticSentences] = useOptimistic(contextSentences, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [customSentences, applyOptimisticCustomSentences] = useOptimistic(contextCustomSentences, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [isCreatingSentence, setIsCreatingSentence] = useState(false);

  const currentDirection = mode ?? 'pl-to-en';
  const directionSettings = settings[currentDirection];
  const reviewStore = sentenceReviewStores[currentDirection];

  const filteredSentences = useMemo(
    () => filterByLevels(contextSentences, directionSettings.selectedLevels),
    [contextSentences, directionSettings.selectedLevels]
  );

  const session = useReviewSession({
    cardKey: 'sentence',
    getId: (sentence) => sentence.id,
    getAudioUrls: (sentence) => [sentence.audioUrl],
    ready: !contextLoading,
    sessionKey: currentDirection,
    getSessionCards: () =>
      getSentenceSessionCards(filteredSentences, reviewStore, directionSettings),
    getPracticeAheadCards: (count) =>
      getSentencePracticeAheadCards(filteredSentences, reviewStore, count),
    getExtraNewCards: (count) => getSentenceExtraNewCards(filteredSentences, reviewStore, count),
    reviewStore,
    recordReview: recordCardReview,
    saveReviewStore: (store) => updateSentenceReviewStore(currentDirection, store),
  });
  const { practice, history } = session;
  const { canGoBack, goBack, goForward } = history;

  const progressStats = useProgressStats();
  const modeStats = progressStats.sentencesByDirection;

  const handleSelectMode = useCallback(
    (direction: TranslationDirection) =>
      navigate(`/sentences/${DIRECTION_ROUTES[direction].route}`),
    [navigate]
  );

  const handleNewCardsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateSentenceSettings(currentDirection, newSettings);
    session.startSession(
      getSentenceSessionCards(
        filterByLevels(contextSentences, newSettings.selectedLevels),
        reviewStore,
        newSettings
      )
    );
  };

  const handleLevelsChange = async (selectedLevels: CEFRLevel[]) => {
    const newSettings = { ...directionSettings, selectedLevels };
    await updateSentenceSettings(currentDirection, newSettings);
    const filtered = filterByLevels(contextSentences, selectedLevels);

    if (practice.active) {
      practice.reshuffle(filtered);
    } else {
      session.startSession(getSentenceSessionCards(filtered, reviewStore, newSettings));
    }
  };

  const toggleLevel = (level: CEFRLevel) => {
    const selected = directionSettings.selectedLevels;
    if (selected.length === 1 && selected.includes(level)) return;
    handleLevelsChange(toggleInArray(selected, level));
  };

  const handleListen = () => {
    const queue = buildSentenceListeningQueue({
      sentences: contextSentences,
      reviewStore,
      ordering: listeningSettings.ordering,
      levels: directionSettings.selectedLevels,
    });
    if (queue.length === 0) {
      showSnackbar('No sentences with audio for the current filters.', 'info');
      return;
    }
    startListening(queue, {
      meta: {
        feature: 'sentences',
        title: 'Sentences',
        subtitle: directionSettings.selectedLevels.join(', '),
      },
    });
    navigate('/listen/play');
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your sentence progress for this direction and cannot be undone.'
      )
    ) {
      await clearSentenceReviewData(currentDirection);
      session.rebuildSession();
      setShowSettings(false);
    }
  };

  const openEditModal = (sentence: Sentence) => {
    setEditingSentence(sentence);
    setIsCreatingSentence(false);
    setShowEditModal(true);
  };

  const replaceSentence = (updatedSentence: Sentence) =>
    session.updateCards(
      (s) => s.id === updatedSentence.id,
      () => updatedSentence
    );

  const saveCustom = (newCustomSentences: CustomSentence[]) =>
    applyOptimisticCustomSentences(newCustomSentences, async () => {
      await saveCustomSentences(newCustomSentences);
      setContextCustomSentences(newCustomSentences);
    });

  const saveSystem = (newSystemSentences: Sentence[], persist: () => Promise<void>) =>
    applyOptimisticSentences([...customSentences, ...newSystemSentences], async () => {
      await persist();
      setContextSystemSentences(newSystemSentences);
    });

  const handleAddSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    const newSentence: CustomSentence = {
      ...sentenceData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      createdAt: Date.now(),
    };
    const newCustomSentences = [...customSentences, newSentence];
    saveCustom(newCustomSentences);

    const merged = [...newCustomSentences, ...contextSystemSentences];
    session.startSession(
      getSentenceSessionCards(
        filterByLevels(merged, directionSettings.selectedLevels),
        reviewStore,
        directionSettings
      )
    );
  };

  const handleSaveSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    if (!editingSentence) return;

    const updatedSentence: Sentence = { ...editingSentence, ...sentenceData };
    replaceSentence(updatedSentence);

    if (editingSentence.isCustom) {
      saveCustom(
        customSentences.map((s) =>
          s.id === editingSentence.id ? (updatedSentence as CustomSentence) : s
        )
      );
      return;
    }

    saveSystem(
      contextSystemSentences.map((s) => (s.id === editingSentence.id ? updatedSentence : s)),
      () => updateSentence(editingSentence.id, sentenceData)
    );
  };

  const deleteSentenceById = (sentenceToDelete: Sentence) => {
    session.removeCards((s) => s.id === sentenceToDelete.id);

    if (sentenceToDelete.isCustom) {
      saveCustom(customSentences.filter((s) => s.id !== sentenceToDelete.id));
      return;
    }

    saveSystem(
      contextSystemSentences.filter((s) => s.id !== sentenceToDelete.id),
      () => deleteSentence(sentenceToDelete.id)
    );
  };

  const handleUpdateTranslation = (sentenceId: string, word: string, translation: string) => {
    const sentence = sentences.find((s) => s.id === sentenceId);
    if (!sentence) return;

    const updatedTranslations = { ...sentence.translations, [word]: translation };
    const updatedSentence = { ...sentence, translations: updatedTranslations };
    replaceSentence(updatedSentence);

    if (sentence.isCustom) {
      saveCustom(
        customSentences.map((s) =>
          s.id === sentenceId ? { ...s, translations: updatedTranslations } : s
        )
      );
      return;
    }

    saveSystem(
      contextSystemSentences.map((s) => (s.id === sentenceId ? updatedSentence : s)),
      () => updateSentenceTranslation(sentenceId, word, translation)
    );
  };

  const translationHandler = (sentence: Sentence) =>
    isAdmin
      ? (word: string, translation: string) =>
          handleUpdateTranslation(sentence.id, word, translation)
      : undefined;

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
      <ReviewControlsRow direction="row" alignItems="center">
        <PracticeModeButton
          active={practice.active}
          onClick={() => practice.toggle(filteredSentences)}
          disabled={isLoading}
        />

        {!practice.active && (
          <SettingsButton
            active={showSettings}
            onClick={() => setShowSettings(!showSettings)}
            disabled={isLoading}
          />
        )}

        <ListenButton
          onClick={handleListen}
          disabled={isLoading}
          aria-label="Start listening mode"
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
      </ReviewControlsRow>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {ALL_LEVELS.map((level) => (
          <LevelChip
            key={level}
            $level={level}
            label={level}
            $active={directionSettings.selectedLevels.includes(level)}
            onClick={() => toggleLevel(level)}
          />
        ))}
      </Stack>

      {showSettings && !practice.active && (
        <SentenceSettingsPanel
          newCardsPerDay={directionSettings.newCardsPerDay}
          user={user}
          onNewCardsChange={handleNewCardsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel={`Reset ${currentDirection === 'pl-to-en' ? 'PL→EN' : 'EN→PL'} Progress`}
        />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <>
            <SessionStatusLine session={session} unitLabel="sentences" />

            <ReviewStage
              session={session}
              practiceEmptyMessage="No sentences available"
              renderPractice={(sentence) => (
                <SentenceFlashcard
                  key={`practice-${sentence.id}-${practice.index}`}
                  sentence={sentence}
                  direction={currentDirection}
                  practiceMode
                  canEdit={isAdmin}
                  onNext={practice.next}
                  onEdit={() => openEditModal(sentence)}
                  onDelete={() => deleteSentenceById(sentence)}
                  onDailyLimitReached={handleDailyLimitReached}
                  onUpdateTranslation={translationHandler(sentence)}
                />
              )}
              renderHistory={(sentence) => (
                <SentenceFlashcard
                  key={`history-${sentence.id}`}
                  sentence={sentence}
                  direction={currentDirection}
                  isViewingHistory
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  reassessIntervals={session.reassessIntervals}
                  onGoBack={goBack}
                  onContinue={goForward}
                  onReassess={session.reassess}
                  onEdit={() => openEditModal(sentence)}
                  onDelete={() => {
                    deleteSentenceById(sentence);
                    goForward();
                  }}
                  onDailyLimitReached={handleDailyLimitReached}
                  onUpdateTranslation={translationHandler(sentence)}
                />
              )}
              renderFinished={() => (
                <FinishedState
                  currentFeature="sentences"
                  currentDirection={currentDirection}
                  otherDirectionDueCount={
                    progressStats.sentencesByDirection[otherDirection(currentDirection)].total.due
                  }
                  otherDirectionLabel={DIRECTION_ROUTES[otherDirection(currentDirection)].label}
                  onSwitchDirection={() => handleSelectMode(otherDirection(currentDirection))}
                  {...session.finishedStateProps}
                />
              )}
              renderCurrent={({ sentence }) => (
                <SentenceFlashcard
                  key={`${sentence.id}-${session.ratingCounter}`}
                  sentence={sentence}
                  direction={currentDirection}
                  intervals={session.intervals}
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  onRate={session.rate}
                  onGoBack={goBack}
                  onEdit={() => openEditModal(sentence)}
                  onDelete={() => deleteSentenceById(sentence)}
                  onDailyLimitReached={handleDailyLimitReached}
                  onUpdateTranslation={translationHandler(sentence)}
                />
              )}
            />
          </>
        )}
      </ReviewMainContent>

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
        onAudioUpdated={(audioUrl) => {
          if (editingSentence) replaceSentence({ ...editingSentence, audioUrl });
        }}
      />
    </>
  );
}

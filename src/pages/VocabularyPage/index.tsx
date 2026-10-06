import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { AddButton } from '../../components/AddButton';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { ListenButton } from '../../components/ListenButton';
import { useListening } from '../../contexts/ListeningContext';
import { buildVocabularyListeningQueue } from '../../lib/listeningScheduler';
import { VocabularyFlashcard } from './components/VocabularyFlashcard';
import { VocabularyModeSelector } from './components/VocabularyModeSelector';
import { FinishedState } from '../../components/FinishedState';
import { ReviewStage } from '../../components/ReviewStage';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SessionStatusLine } from '../../components/SessionStatusLine';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { AddVocabularyModal } from '../../components/AddVocabularyModal';
import { SuggestVocabularyExamplesModal } from '../../components/SuggestVocabularyExamplesModal';
import type {
  VocabularyWord,
  VocabularyWordId,
  CustomVocabularyWord,
  ExampleSentence,
} from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { createCustomItem } from '../../types/customItems';
import { saveCustomVocabulary } from '../../lib/storage/customVocabulary';
import { findCustomWordWithSamePolish } from '../../lib/utils/findDuplicateCustomVocabularyPolish';
import {
  updateSystemVocabularyWord,
  deleteSystemVocabularyWord,
} from '../../lib/storage/systemVocabulary';
import getVocabularySessionCards from '../../lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../../lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../../lib/vocabularyScheduler/getVocabularyExtraNewCards';
import { recordCardReview } from '../../lib/reviewSession/recordReview';
import { DIRECTION_ROUTES, otherDirection, toModeStats } from '../../lib/reviewSession/directions';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useAddToVocabulary } from '../../hooks/useAddToVocabulary';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useReviewData } from '../../hooks/useReviewData';
import { useProgressStats } from '../../hooks/useProgressStats';
import { useReviewSession } from '../../hooks/useReviewSession';
import { useReprioritizeVocabularyWord } from '../../hooks/useReprioritizeVocabularyWord';

type WordFormData = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

interface VocabularyPageProps {
  mode?: TranslationDirection;
}

export function VocabularyPage({ mode }: VocabularyPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { settings: appSettings } = useAppSettings();
  const addToVocabulary = useAddToVocabulary();
  const { showSnackbar } = useSnackbar();
  const { showDuplicateError } = useReprioritizeVocabularyWord();
  const {
    loading: contextLoading,
    vocabularyReviewStores,
    vocabularySettings: settings,
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

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<CustomVocabularyWord | VocabularyWord | null>(
    null
  );
  const [generateSentencesForWord, setGenerateSentencesForWord] = useState<VocabularyWord | null>(
    null
  );

  const currentDirection = mode ?? 'pl-to-en';
  const directionSettings = settings[currentDirection];
  const reviewStore = vocabularyReviewStores[currentDirection];

  const allWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  const session = useReviewSession({
    cardKey: 'word',
    getId: (word) => word.id,
    getAudioUrls: (word) => [word.audioUrl],
    ready: !contextLoading,
    sessionKey: currentDirection,
    getSessionCards: () => getVocabularySessionCards(allWords, reviewStore, directionSettings),
    getPracticeAheadCards: (count) => getVocabularyPracticeAheadCards(allWords, reviewStore, count),
    getExtraNewCards: (count) => getVocabularyExtraNewCards(allWords, reviewStore, count),
    reviewStore,
    recordReview: recordCardReview,
    saveReviewStore: (store) => updateVocabularyReviewStore(currentDirection, store),
  });
  const { practice, history } = session;
  const { canGoBack, goBack, goForward } = history;

  const progressStats = useProgressStats();
  const modeStats = toModeStats(progressStats.vocabularyByDirection);

  const handleSelectMode = useCallback(
    (direction: TranslationDirection) =>
      navigate(`/vocabulary/${DIRECTION_ROUTES[direction].route}`),
    [navigate]
  );

  const canModify = (word: VocabularyWord) => word.isCustom === true || isAdmin;

  const saveCustom = (newCustomWords: CustomVocabularyWord[]) =>
    applyOptimisticCustomWords(newCustomWords, async () => {
      await saveCustomVocabulary(newCustomWords);
      setContextCustomWords(newCustomWords);
    });

  const saveSystem = (newSystemWords: VocabularyWord[], persist: () => Promise<void>) =>
    applyOptimisticSystemWords(newSystemWords, async () => {
      await persist();
      setContextSystemWords(newSystemWords);
    });

  const updateWordEverywhere = (wordId: VocabularyWordId, updates: Partial<VocabularyWord>) =>
    session.updateCards(
      (w) => w.id === wordId,
      (w) => ({ ...w, ...updates })
    );

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...directionSettings, newCardsPerDay };
    await updateVocabularySettings(currentDirection, newSettings);
    session.startSession(getVocabularySessionCards(allWords, reviewStore, newSettings));
  };

  const handleListen = () => {
    const queue = buildVocabularyListeningQueue({
      words: allWords,
      reviewStore,
      ordering: listeningSettings.ordering,
    });
    if (queue.length === 0) {
      showSnackbar('No vocabulary with audio available.', 'info');
      return;
    }
    startListening(queue, {
      meta: { feature: 'vocabulary', title: 'Vocabulary' },
    });
    navigate('/listen/play');
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your vocabulary progress for this direction and cannot be undone.'
      )
    ) {
      await clearVocabularyReviewData(currentDirection);
      session.rebuildSession();
      setShowSettings(false);
    }
  };

  const handleAddWord = (wordData: WordFormData) => {
    const duplicate = findCustomWordWithSamePolish(customWords, wordData.polish);
    if (duplicate) {
      showDuplicateError(duplicate.id);
      return false;
    }
    const newWord = createCustomItem(wordData);
    const newCustomWords = [...customWords, newWord];
    saveCustom(newCustomWords);

    session.startSession(
      getVocabularySessionCards([...newCustomWords, ...systemWords], reviewStore, directionSettings)
    );

    if (isAdmin && appSettings.suggestExamplesAfterAddingWord) {
      addToVocabulary?.openSuggestExamples(newWord);
    }
  };

  const handleEditWord = (wordData: WordFormData) => {
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

    if (editingWord.isCustom === true) {
      if (findCustomWordWithSamePolish(customWords, wordData.polish, wordId)) {
        showSnackbar('This Polish word is already in your custom vocabulary.', 'error');
        return false;
      }
      setEditingWord(null);
      saveCustom(customWords.map((w) => (w.id === wordId ? mergeWordData(w) : w)));
    } else {
      setEditingWord(null);
      saveSystem(
        systemWords.map((w) => (w.id === wordId ? mergeWordData(w) : w)),
        () => updateSystemVocabularyWord(wordId as number, wordData)
      );
    }
    updateWordEverywhere(wordId, wordData);
  };

  const openEditModal = (word: VocabularyWord) => {
    if (!canModify(word)) return;
    setEditingWord(word);
    setShowAddModal(true);
  };

  const deleteWord = (word: VocabularyWord): boolean => {
    if (!canModify(word)) return false;
    const isCustomWord = word.isCustom === true;

    const confirmMessage = isCustomWord
      ? 'Are you sure you want to delete this custom word?'
      : 'Are you sure you want to delete this system vocabulary word? This will affect all users.';
    if (!window.confirm(confirmMessage)) return false;

    if (isCustomWord) {
      saveCustom(customWords.filter((w) => w.id !== word.id));
    } else {
      saveSystem(
        systemWords.filter((w) => w.id !== word.id),
        () => deleteSystemVocabularyWord(word.id as number)
      );
    }
    session.removeCards((w) => w.id === word.id);
    return true;
  };

  const getGenerateSentencesHandler = (word: VocabularyWord) =>
    canModify(word) ? () => setGenerateSentencesForWord(word) : undefined;

  const handleSaveGeneratedSentences = async (newExamples: ExampleSentence[]) => {
    if (!generateSentencesForWord || newExamples.length === 0) return;
    const targetWord = generateSentencesForWord;
    const wordId = targetWord.id;
    const mergedExamples = [...(targetWord.examples ?? []), ...newExamples];

    if (targetWord.isCustom === true) {
      saveCustom(
        customWords.map((w) => (w.id === wordId ? { ...w, examples: mergedExamples } : w))
      );
    } else {
      if (!isAdmin) return;
      saveSystem(
        systemWords.map((w) => (w.id === wordId ? { ...w, examples: mergedExamples } : w)),
        () => updateSystemVocabularyWord(wordId as number, { examples: mergedExamples })
      );
    }

    updateWordEverywhere(wordId, { examples: mergedExamples });
  };

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
      <ReviewControlsRow direction="row" alignItems="center">
        <PracticeModeButton
          active={practice.active}
          onClick={() => practice.toggle(allWords)}
          disabled={isLoading}
        />

        <SettingsButton
          active={showSettings}
          onClick={() => setShowSettings(!showSettings)}
          disabled={isLoading}
        />

        <ListenButton
          onClick={handleListen}
          disabled={isLoading}
          aria-label="Start listening mode"
        />

        {user && (
          <AddButton
            onClick={() => setShowAddModal(true)}
            aria-label="add word"
            disabled={isLoading}
          />
        )}
      </ReviewControlsRow>

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
            <SessionStatusLine session={session} unitLabel="words" />

            <ReviewStage
              session={session}
              practiceEmptyMessage="No words available"
              renderPractice={(word) => (
                <VocabularyFlashcard
                  key={`practice-${word.id}-${practice.index}`}
                  word={word}
                  direction={currentDirection}
                  practiceMode
                  isAdmin={isAdmin}
                  onNext={practice.next}
                  onGenerateSentences={getGenerateSentencesHandler(word)}
                  onEdit={() => openEditModal(word)}
                  onDelete={() => deleteWord(word)}
                />
              )}
              renderHistory={(word) => (
                <VocabularyFlashcard
                  key={`history-${word.id}`}
                  word={word}
                  direction={currentDirection}
                  isViewingHistory
                  canGoBack={canGoBack}
                  isAdmin={isAdmin}
                  reassessIntervals={session.reassessIntervals}
                  onGoBack={goBack}
                  onContinue={goForward}
                  onReassess={session.reassess}
                  onGenerateSentences={getGenerateSentencesHandler(word)}
                  onEdit={() => openEditModal(word)}
                  onDelete={() => {
                    if (deleteWord(word)) goForward();
                  }}
                />
              )}
              renderFinished={() => (
                <FinishedState
                  currentFeature="vocabulary"
                  currentDirection={currentDirection}
                  otherDirectionDueCount={
                    progressStats.vocabularyByDirection[otherDirection(currentDirection)].due
                  }
                  otherDirectionLabel={DIRECTION_ROUTES[otherDirection(currentDirection)].label}
                  onSwitchDirection={() => handleSelectMode(otherDirection(currentDirection))}
                  {...session.finishedStateProps}
                />
              )}
              renderCurrent={({ word }) => (
                <VocabularyFlashcard
                  key={`${word.id}-${session.ratingCounter}`}
                  word={word}
                  direction={currentDirection}
                  intervals={session.intervals}
                  canGoBack={canGoBack}
                  isAdmin={isAdmin}
                  onRate={session.rate}
                  onGoBack={goBack}
                  onEdit={() => openEditModal(word)}
                  onDelete={() => deleteWord(word)}
                  onGenerateSentences={getGenerateSentencesHandler(word)}
                />
              )}
            />
          </>
        )}
      </ReviewMainContent>

      <AddVocabularyModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingWord(null);
        }}
        onSave={editingWord ? handleEditWord : handleAddWord}
        editWord={editingWord}
        onAudioUpdated={(audioUrl) => {
          if (editingWord) updateWordEverywhere(editingWord.id, { audioUrl });
        }}
      />

      <SuggestVocabularyExamplesModal
        open={!!generateSentencesForWord}
        word={generateSentencesForWord}
        onClose={() => setGenerateSentencesForWord(null)}
        onSave={handleSaveGeneratedSentences}
      />
    </>
  );
}

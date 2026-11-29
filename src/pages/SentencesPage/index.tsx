import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Stack } from '@mui/material';
import { AddButton } from '../../components/AddButton';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { ListenButton } from '../../components/ListenButton';
import { useListening } from '../../contexts/ListeningContext';
import { buildSentenceListeningQueue } from '../../lib/listeningScheduler';
import { SentenceFlashcard } from './components/SentenceFlashcard';
import { ReviewStage } from '../../components/ReviewStage';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { SettingsPanel } from '../../components/SettingsPanel';
import { ToggleLevelChip } from '../../components/LevelChip';
import { EditSentenceModal } from '../../components/EditSentenceModal';
import type { Sentence, CustomSentence, CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { createCustomItem } from '../../types/customItems';
import { sentenceDeck } from '../../lib/reviewSession/reviewDecks';
import toggleInArray from '../../lib/utils/toggleInArray';
import { useAuthContext } from '../../contexts/AuthContext';
import { useReviewDataLoading, useSentences } from '../../hooks/useReviewData';
import { useCustomItemWrites } from '../../hooks/useCustomItemWrites';
import { useSaveError } from '../../hooks/useSaveError';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useDeckReview } from '../../hooks/useDeckReview';
import {
  updateSentence,
  deleteSentence,
  updateSentenceTranslation,
} from '../../lib/storage/systemSentences';
import { customSentenceStorage } from '../../lib/storage/customSentences';
import { writeBuiltIn } from '../../lib/storage/writeBuiltIn';

const filterByLevels = (sentences: Sentence[], levels: CEFRLevel[]) =>
  sentences.filter((s) => levels.includes(s.level));

interface SentencesPageProps {
  mode: TranslationDirection;
}

export function SentencesPage({ mode }: SentencesPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const loading = useReviewDataLoading();
  const { progress, sentences, systemSentences, setCustomSentences, setSystemSentences } =
    useSentences();
  const customWrites = useCustomItemWrites(customSentenceStorage, setCustomSentences);

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showEditModal, setShowEditModal] = useState(false);
  // Null while the modal adds a new sentence.
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);

  const { selectedLevels } = progress.settings[mode];
  const levelSentences = useMemo(
    () => filterByLevels(sentences, selectedLevels),
    [sentences, selectedLevels]
  );

  const review = useDeckReview(progress, mode, {
    deck: sentenceDeck,
    items: levelSentences,
    ready: !loading,
    getAudioUrls: (sentence) => [sentence.audioUrl],
    confirm,
    resetMessage:
      'Are you sure? This will erase all your sentence progress for this direction and cannot be undone.',
  });
  const { session } = review;
  const { practice } = session;

  const handleLevelsChange = async (levels: CEFRLevel[]) => {
    await progress.updateSettings(mode, { ...review.settings, selectedLevels: levels });
    if (practice.active) {
      practice.reshuffle(filterByLevels(sentences, levels));
    } else {
      session.restartAfterRender();
    }
  };

  const toggleLevel = (level: CEFRLevel) => {
    if (selectedLevels.length === 1 && selectedLevels.includes(level)) return;
    handleLevelsChange(toggleInArray(selectedLevels, level));
  };

  const handleListen = () => {
    const queue = buildSentenceListeningQueue({
      sentences,
      reviewStore: review.store,
      ordering: listeningSettings.ordering,
      levels: selectedLevels,
    });
    if (queue.length === 0) {
      showSnackbar('No sentences with audio for the current filters.', 'info');
      return;
    }
    startListening(queue, {
      meta: {
        feature: 'sentences',
        title: 'Sentences',
        subtitle: selectedLevels.join(', '),
      },
    });
    navigate('/listen/play');
  };

  const openEditModal = (sentence: Sentence | null) => {
    setEditingSentence(sentence);
    setShowEditModal(true);
  };

  const replaceSentence = (updatedSentence: Sentence) =>
    session.updateCards(
      (s) => s.id === updatedSentence.id,
      () => updatedSentence
    );

  /** Saves a change to one sentence: the learner's own, or (for an admin) a built-in one. */
  const saveSentence = (
    sentence: Sentence,
    changes: Partial<Omit<Sentence, 'id'>>,
    saveBuiltIn: () => Promise<void>
  ) =>
    sentence.isCustom
      ? customWrites.update(sentence.id, changes as Partial<CustomSentence>)
      : writeBuiltIn(
          systemSentences,
          setSystemSentences,
          systemSentences.map((s) => (s.id === sentence.id ? { ...s, ...changes } : s)),
          saveBuiltIn
        );

  const handleSaveSentence = (sentenceData: Omit<Sentence, 'id'>) => {
    if (!editingSentence) {
      const saved = customWrites.add(createCustomItem(sentenceData));
      session.restartAfterRender();
      return saved;
    }
    replaceSentence({ ...editingSentence, ...sentenceData });
    return saveSentence(editingSentence, sentenceData, () =>
      updateSentence(editingSentence.id, sentenceData)
    );
  };

  const removeSentence = (sentence: Sentence) => {
    session.removeCards((s) => s.id === sentence.id);
    const removed = sentence.isCustom
      ? customWrites.remove(sentence.id)
      : writeBuiltIn(
          systemSentences,
          setSystemSentences,
          systemSentences.filter((s) => s.id !== sentence.id),
          () => deleteSentence(sentence.id)
        );
    void removed.catch(showSaveError);
  };

  const updateTranslation = (sentenceId: string, word: string, translation: string) => {
    const sentence = sentences.find((s) => s.id === sentenceId);
    if (!sentence) return;
    const translations = { ...sentence.translations, [word]: translation };
    replaceSentence({ ...sentence, translations });
    void saveSentence(sentence, { translations }, () =>
      updateSentenceTranslation(sentenceId, word, translation)
    ).catch(showSaveError);
  };

  const isLoading = loading || !session.isBuilt;

  return (
    <>
      <ReviewControlsRow direction="row" alignItems="center">
        <PracticeModeButton
          active={practice.active}
          onClick={session.togglePractice}
          disabled={isLoading}
        />

        {!practice.active && (
          <SettingsButton
            active={review.showSettings}
            onClick={review.toggleSettings}
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
            onClick={() => openEditModal(null)}
            aria-label="add sentence"
            disabled={isLoading}
          />
        )}
      </ReviewControlsRow>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {ALL_LEVELS.map((level) => (
          <ToggleLevelChip
            key={level}
            $level={level}
            label={level}
            $active={selectedLevels.includes(level)}
            onClick={() => toggleLevel(level)}
          />
        ))}
      </Stack>

      {review.showSettings && !practice.active && (
        <SettingsPanel {...review.settingsPanel} user={user} />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <ReviewStage
            session={session}
            feature="sentences"
            direction={mode}
            unitLabel="sentences"
            practiceEmptyMessage="No sentences available"
            renderCard={(sentence, controls) => (
              <SentenceFlashcard
                {...controls}
                sentence={sentence}
                direction={mode}
                canEdit={isAdmin}
                onEdit={() => openEditModal(sentence)}
                onDelete={() => {
                  removeSentence(sentence);
                  controls.onContinue?.();
                }}
                onUpdateTranslation={
                  isAdmin
                    ? (word, translation) => updateTranslation(sentence.id, word, translation)
                    : undefined
                }
              />
            )}
          />
        )}
      </ReviewMainContent>

      <EditSentenceModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingSentence(null);
        }}
        onSave={handleSaveSentence}
        sentence={editingSentence}
        onAudioUpdated={(audioUrl) => {
          if (editingSentence) replaceSentence({ ...editingSentence, audioUrl });
        }}
      />
      {confirmDialog}
    </>
  );
}

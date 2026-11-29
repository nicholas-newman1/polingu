import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { AddButton } from '../../components/AddButton';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { ListenButton } from '../../components/ListenButton';
import { useListening } from '../../contexts/ListeningContext';
import { buildVocabularyListeningQueue } from '../../lib/listeningScheduler';
import { VocabularyFlashcard } from './components/VocabularyFlashcard';
import { ReviewStage } from '../../components/ReviewStage';
import { SettingsPanel } from '../../components/SettingsPanel';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { AddVocabularyModal } from '../../components/AddVocabularyModal';
import { SuggestVocabularyExamplesModal } from '../../components/SuggestVocabularyExamplesModal';
import type { VocabularyWord, CustomVocabularyWord, ExampleSentence } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { createCustomItem } from '../../types/customItems';
import { customVocabularyStorage } from '../../lib/storage/customVocabulary';
import { writeBuiltIn } from '../../lib/storage/writeBuiltIn';
import { findWordWithSamePolish } from '../../lib/utils/findDuplicateCustomVocabularyPolish';
import {
  updateSystemVocabularyWord,
  deleteSystemVocabularyWord,
} from '../../lib/storage/systemVocabulary';
import { vocabularyDeck } from '../../lib/reviewSession/reviewDecks';
import { useAuthContext } from '../../contexts/AuthContext';
import { useCustomItemWrites } from '../../hooks/useCustomItemWrites';
import { useSaveError } from '../../hooks/useSaveError';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useReviewDataLoading, useVocabulary } from '../../hooks/useReviewData';
import { useDeckReview } from '../../hooks/useDeckReview';
import { useReprioritizeVocabularyWord } from '../../hooks/useReprioritizeVocabularyWord';

type WordFormData = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

interface VocabularyPageProps {
  mode: TranslationDirection;
}

export function VocabularyPage({ mode }: VocabularyPageProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const { reportDuplicatePolish } = useReprioritizeVocabularyWord();
  const loading = useReviewDataLoading();
  const { progress, words, customWords, systemWords, setCustomWords, setSystemWords } =
    useVocabulary();
  const customWrites = useCustomItemWrites(customVocabularyStorage, setCustomWords);

  const { start: startListening, settings: listeningSettings } = useListening();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [generateSentencesForWord, setGenerateSentencesForWord] = useState<VocabularyWord | null>(
    null
  );

  const review = useDeckReview(progress, mode, {
    deck: vocabularyDeck,
    items: words,
    ready: !loading,
    getAudioUrls: (word) => [word.audioUrl],
    confirm,
    resetMessage:
      'Are you sure? This will erase all your vocabulary progress for this direction and cannot be undone.',
  });
  const { session } = review;
  const { practice } = session;

  const canModify = (word: VocabularyWord) => word.isCustom === true || isAdmin;

  /** Saves a change to one word: the learner's own, or (for an admin) a built-in one. */
  const saveWord = (
    word: VocabularyWord,
    changes: Partial<WordFormData>,
    saveBuiltIn: () => Promise<void>
  ) =>
    word.isCustom === true
      ? customWrites.update(word.id as string, changes)
      : writeBuiltIn(
          systemWords,
          setSystemWords,
          systemWords.map((w) => (w.id === word.id ? { ...w, ...changes } : w)),
          saveBuiltIn
        );

  const updateWordEverywhere = (word: VocabularyWord, updates: Partial<VocabularyWord>) =>
    session.updateCards(
      (w) => w.id === word.id,
      (w) => ({ ...w, ...updates })
    );

  const handleListen = () => {
    const queue = buildVocabularyListeningQueue({
      words,
      reviewStore: review.store,
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

  const handleAddWord = (wordData: WordFormData) => {
    if (reportDuplicatePolish(customWords, wordData.polish)) return false;
    const saved = customWrites.add(createCustomItem(wordData));
    session.restartAfterRender();
    return saved;
  };

  const handleEditWord = (wordData: WordFormData) => {
    if (!editingWord) return;
    if (
      editingWord.isCustom === true &&
      findWordWithSamePolish(customWords, wordData.polish, editingWord.id)
    ) {
      showSnackbar('This Polish word is already in your custom vocabulary.', 'error');
      return false;
    }
    const { polish, english, partOfSpeech, gender, notes, examples } = wordData;
    updateWordEverywhere(editingWord, wordData);
    return saveWord(editingWord, { polish, english, partOfSpeech, gender, notes, examples }, () =>
      updateSystemVocabularyWord(editingWord.id as number, wordData)
    );
  };

  const openEditModal = (word: VocabularyWord) => {
    if (!canModify(word)) return;
    setEditingWord(word);
    setShowAddModal(true);
  };

  const deleteWord = async (word: VocabularyWord): Promise<boolean> => {
    if (!canModify(word)) return false;
    const isCustomWord = word.isCustom === true;

    const confirmed = await confirm({
      title: 'Delete Word',
      message: isCustomWord
        ? 'Are you sure you want to delete this custom word?'
        : 'Are you sure you want to delete this system vocabulary word? This will affect all users.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return false;

    const removed = isCustomWord
      ? customWrites.remove(word.id as string)
      : writeBuiltIn(
          systemWords,
          setSystemWords,
          systemWords.filter((w) => w.id !== word.id),
          () => deleteSystemVocabularyWord(word.id as number)
        );
    void removed.catch(showSaveError);
    session.removeCards((w) => w.id === word.id);
    return true;
  };

  const handleSaveGeneratedSentences = (newExamples: ExampleSentence[]) => {
    const word = generateSentencesForWord;
    if (!word || newExamples.length === 0 || !canModify(word)) return;
    const examples = [...(word.examples ?? []), ...newExamples];
    updateWordEverywhere(word, { examples });
    return saveWord(word, { examples }, () =>
      updateSystemVocabularyWord(word.id as number, { examples })
    );
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

        <SettingsButton
          active={review.showSettings}
          onClick={review.toggleSettings}
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

      {review.showSettings && !practice.active && (
        <SettingsPanel {...review.settingsPanel} user={user} />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <ReviewStage
            session={session}
            feature="vocabulary"
            direction={mode}
            unitLabel="words"
            practiceEmptyMessage="No words available"
            renderCard={(word, controls) => (
              <VocabularyFlashcard
                {...controls}
                word={word}
                direction={mode}
                isAdmin={isAdmin}
                onEdit={() => openEditModal(word)}
                onDelete={async () => {
                  if (await deleteWord(word)) controls.onContinue?.();
                }}
                onGenerateSentences={
                  canModify(word) ? () => setGenerateSentencesForWord(word) : undefined
                }
              />
            )}
          />
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
          if (editingWord) updateWordEverywhere(editingWord, { audioUrl });
        }}
      />

      <SuggestVocabularyExamplesModal
        open={!!generateSentencesForWord}
        word={generateSentencesForWord}
        onClose={() => setGenerateSentencesForWord(null)}
        onSave={handleSaveGeneratedSentences}
      />
      {confirmDialog}
    </>
  );
}

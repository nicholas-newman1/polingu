import { createContext, useState, useCallback, type ReactNode } from 'react';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { SuggestVocabularyExamplesModal } from '../components/SuggestVocabularyExamplesModal';
import { loadCustomVocabulary, saveCustomVocabulary } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord, ExampleSentence } from '../types/vocabulary';
import { useVocabulary } from '../hooks/useReviewData';
import { normalizeVocabularyPrefill } from '../lib/utils/normalizeVocabularyPrefill';
import { findCustomWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
} from '../lib/storage/reprioritizeVocabularyWord';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAuthContext } from '../hooks/useAuthContext';
import { useAppSettings } from './AppSettingsContext';

export interface AddToVocabularyContextType {
  openAddToVocabulary: (polish: string, english: string) => void;
  openSuggestExamples: (word: CustomVocabularyWord) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AddToVocabularyContext = createContext<AddToVocabularyContextType | null>(null);

interface AddToVocabularyProviderProps {
  children: ReactNode;
}

export function AddToVocabularyProvider({ children }: AddToVocabularyProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<
    { polish: string; english: string } | undefined
  >();
  const [suggestExamplesForWord, setSuggestExamplesForWord] = useState<CustomVocabularyWord | null>(
    null
  );

  const { refreshVocabularyWords, vocabularyReviewStores, updateVocabularyReviewStore } =
    useVocabulary();
  const { showSnackbar } = useSnackbar();
  const { isAdmin } = useAuthContext();
  const { settings: appSettings } = useAppSettings();

  const openAddToVocabulary = useCallback((polish: string, english: string) => {
    setInitialValues({
      polish: normalizeVocabularyPrefill(polish),
      english: normalizeVocabularyPrefill(english),
    });
    setModalOpen(true);
  }, []);

  const openSuggestExamples = useCallback((word: CustomVocabularyWord) => {
    setSuggestExamplesForWord(word);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const handleCloseSuggest = useCallback(() => {
    setSuggestExamplesForWord(null);
  }, []);

  const handleReprioritize = useCallback(
    (wordId: string) => {
      const plToEnNext = reprioritizeVocabularyWord(vocabularyReviewStores['pl-to-en'], wordId);
      const enToPlNext = reprioritizeVocabularyWord(vocabularyReviewStores['en-to-pl'], wordId);
      const promises: Promise<void>[] = [];
      if (plToEnNext !== vocabularyReviewStores['pl-to-en']) {
        promises.push(updateVocabularyReviewStore('pl-to-en', plToEnNext));
      }
      if (enToPlNext !== vocabularyReviewStores['en-to-pl']) {
        promises.push(updateVocabularyReviewStore('en-to-pl', enToPlNext));
      }
      if (promises.length === 0) return;
      void Promise.all(promises);
      showSnackbar('Word queued for review again.', 'success');
    },
    [vocabularyReviewStores, updateVocabularyReviewStore, showSnackbar]
  );

  const handleSave = useCallback(
    async (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
      const loaded = await loadCustomVocabulary();
      const duplicate = findCustomWordWithSamePolish(loaded, wordData.polish);
      if (duplicate) {
        const reviewable = canReprioritizeVocabularyWord(vocabularyReviewStores, duplicate.id);
        showSnackbar(
          'This Polish word is already in your custom vocabulary.',
          'error',
          reviewable
            ? {
                action: {
                  label: 'Review again',
                  onClick: () => handleReprioritize(String(duplicate.id)),
                },
              }
            : undefined
        );
        return false;
      }
      const newWord: CustomVocabularyWord = {
        ...wordData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomVocabulary = [newWord, ...loaded];
      await saveCustomVocabulary(newCustomVocabulary);
      await refreshVocabularyWords();

      if (isAdmin && appSettings.suggestExamplesAfterAddingWord) {
        setSuggestExamplesForWord(newWord);
      }
    },
    [
      refreshVocabularyWords,
      showSnackbar,
      vocabularyReviewStores,
      handleReprioritize,
      isAdmin,
      appSettings.suggestExamplesAfterAddingWord,
    ]
  );

  const handleSaveSuggestedExamples = useCallback(
    async (newExamples: ExampleSentence[]) => {
      if (!suggestExamplesForWord || newExamples.length === 0) return;
      const wordId = suggestExamplesForWord.id;
      const loaded = await loadCustomVocabulary();
      const updated = loaded.map((w) =>
        w.id === wordId ? { ...w, examples: [...(w.examples ?? []), ...newExamples] } : w
      );
      await saveCustomVocabulary(updated);
      await refreshVocabularyWords();
    },
    [suggestExamplesForWord, refreshVocabularyWords]
  );

  return (
    <AddToVocabularyContext.Provider value={{ openAddToVocabulary, openSuggestExamples }}>
      {children}
      <AddVocabularyModal
        open={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        initialValues={initialValues}
      />
      <SuggestVocabularyExamplesModal
        open={!!suggestExamplesForWord}
        word={suggestExamplesForWord}
        onClose={handleCloseSuggest}
        onSave={handleSaveSuggestedExamples}
      />
    </AddToVocabularyContext.Provider>
  );
}

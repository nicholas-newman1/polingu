import { createContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { loadCustomVocabulary, saveCustomVocabulary } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord } from '../types/vocabulary';
import { useVocabulary } from '../hooks/useReviewData';
import { normalizeVocabularyPrefill } from '../lib/utils/normalizeVocabularyPrefill';
import { findCustomWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import { useReprioritizeVocabularyWord } from '../hooks/useReprioritizeVocabularyWord';

type NewWord = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

interface AddToVocabularyContextType {
  openAddToVocabulary: (polish: string, english: string) => void;
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
  // The saved words, read when the dialog opens, so a duplicate is caught
  // synchronously and the dialog stays open with what was typed.
  const savedRef = useRef<CustomVocabularyWord[]>([]);

  const { customWords, refreshVocabularyWords } = useVocabulary();
  const { showDuplicateError } = useReprioritizeVocabularyWord();

  const openAddToVocabulary = useCallback((polish: string, english: string) => {
    setInitialValues({
      polish: normalizeVocabularyPrefill(polish),
      english: normalizeVocabularyPrefill(english),
    });
    setModalOpen(true);
    savedRef.current = [];
    loadCustomVocabulary().then(
      (loaded) => (savedRef.current = loaded),
      (e) => console.error('Failed to load custom vocabulary:', e)
    );
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const reportDuplicate = useCallback(
    (words: CustomVocabularyWord[], polish: string) => {
      const duplicate = findCustomWordWithSamePolish(words, polish);
      if (duplicate) showDuplicateError(duplicate.id);
      return !!duplicate;
    },
    [showDuplicateError]
  );

  const addWord = useCallback(
    async (wordData: NewWord) => {
      const loaded = await loadCustomVocabulary();
      // Checked again in case the save came before the list above had loaded.
      if (reportDuplicate(loaded, wordData.polish)) return;
      const newWord: CustomVocabularyWord = {
        ...wordData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomVocabulary = [newWord, ...loaded];
      await saveCustomVocabulary(newCustomVocabulary);
      await refreshVocabularyWords();
    },
    [refreshVocabularyWords, reportDuplicate]
  );

  const handleSave = useCallback(
    (wordData: NewWord) =>
      // The live list covers words the stored copy may not have yet.
      reportDuplicate([...customWords, ...savedRef.current], wordData.polish)
        ? false
        : addWord(wordData),
    [customWords, reportDuplicate, addWord]
  );

  return (
    <AddToVocabularyContext.Provider value={{ openAddToVocabulary }}>
      {children}
      <AddVocabularyModal
        open={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        initialValues={initialValues}
      />
    </AddToVocabularyContext.Provider>
  );
}

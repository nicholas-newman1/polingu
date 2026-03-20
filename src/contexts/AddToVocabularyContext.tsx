import { createContext, useState, useCallback, type ReactNode } from 'react';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { loadCustomVocabulary, saveCustomVocabulary } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord } from '../types/vocabulary';
import { useVocabulary } from '../hooks/useReviewData';
import { normalizeVocabularyPrefill } from '../lib/utils/normalizeVocabularyPrefill';
import { findCustomWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import { useSnackbar } from '../hooks/useSnackbar';

export interface AddToVocabularyContextType {
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
  const { refreshVocabularyWords } = useVocabulary();
  const { showSnackbar } = useSnackbar();

  const openAddToVocabulary = useCallback((polish: string, english: string) => {
    setInitialValues({
      polish: normalizeVocabularyPrefill(polish),
      english: normalizeVocabularyPrefill(english),
    });
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const handleSave = useCallback(
    async (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
      const loaded = await loadCustomVocabulary();
      if (findCustomWordWithSamePolish(loaded, wordData.polish)) {
        showSnackbar('This Polish word is already in your custom vocabulary.', 'error');
        return false;
      }
      const newWord: CustomVocabularyWord = {
        ...wordData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomWords = [newWord, ...loaded];
      await saveCustomVocabulary(newCustomWords);
      await refreshVocabularyWords();
    },
    [refreshVocabularyWords, showSnackbar]
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

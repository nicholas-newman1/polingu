import { createContext, useState, useCallback, type ReactNode } from 'react';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { loadCustomVocabulary, saveCustomVocabulary } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord } from '../types/vocabulary';
import { useVocabulary } from '../hooks/useReviewData';

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

  const openAddToVocabulary = useCallback((polish: string, english: string) => {
    setInitialValues({ polish, english });
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const handleSave = useCallback(
    async (wordData: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
      const newWord: CustomVocabularyWord = {
        ...wordData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const loaded = await loadCustomVocabulary();
      const newCustomWords = [newWord, ...loaded];
      await saveCustomVocabulary(newCustomWords);
      await refreshVocabularyWords();
      handleClose();
    },
    [refreshVocabularyWords, handleClose]
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

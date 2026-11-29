import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AddVocabularyModal } from '../components/AddVocabularyModal';
import { customVocabularyStorage } from '../lib/storage/customVocabulary';
import type { CustomVocabularyWord } from '../types/vocabulary';
import { createCustomItem } from '../types/customItems';
import { useVocabulary } from '../hooks/useReviewData';
import { normalizeVocabularyPrefill } from '../lib/utils/normalizeVocabularyPrefill';
import { useReprioritizeVocabularyWord } from '../hooks/useReprioritizeVocabularyWord';
import { useCustomItemWrites } from '../hooks/useCustomItemWrites';

type NewWord = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

interface AddToVocabularyContextType {
  openAddToVocabulary: (polish: string, english: string) => void;
}

export const AddToVocabularyContext = createContext<AddToVocabularyContextType | null>(null);

interface AddToVocabularyProviderProps {
  children: ReactNode;
}

export function AddToVocabularyProvider({ children }: AddToVocabularyProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<
    { polish: string; english: string } | undefined
  >();

  const { customWords, setCustomWords } = useVocabulary();
  const { reportDuplicatePolish } = useReprioritizeVocabularyWord();
  const { add } = useCustomItemWrites(customVocabularyStorage, setCustomWords);

  const openAddToVocabulary = useCallback((polish: string, english: string) => {
    setInitialValues({
      polish: normalizeVocabularyPrefill(polish),
      english: normalizeVocabularyPrefill(english),
    });
    setModalOpen(true);
  }, []);

  // Every translatable word reads this context, so a stable value keeps them from re-rendering.
  const value = useMemo(() => ({ openAddToVocabulary }), [openAddToVocabulary]);

  const handleClose = () => {
    setModalOpen(false);
    setInitialValues(undefined);
  };

  const handleSave = (wordData: NewWord) =>
    reportDuplicatePolish(customWords, wordData.polish) ? false : add(createCustomItem(wordData));

  return (
    <AddToVocabularyContext.Provider value={value}>
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

export function useAddToVocabulary() {
  const context = useContext(AddToVocabularyContext);
  return context;
}

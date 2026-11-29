import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { customSentenceStorage } from '../lib/storage/customSentences';
import { findCustomSentenceWithSamePolish } from '../lib/utils/findDuplicateCustomSentence';
import type { Sentence } from '../types/sentences';
import { createCustomItem } from '../types/customItems';
import { useSentences } from '../hooks/useReviewData';
import { useReprioritizeSentence } from '../hooks/useReprioritizeSentence';
import { useCustomItemWrites } from '../hooks/useCustomItemWrites';

interface AddSentenceContextType {
  openAddSentence: (initialValues?: { polish?: string; english?: string }) => void;
}

export const AddSentenceContext = createContext<AddSentenceContextType | null>(null);

interface AddSentenceProviderProps {
  children: ReactNode;
}

export function AddSentenceProvider({ children }: AddSentenceProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<
    { polish?: string; english?: string } | undefined
  >();
  const { customSentences, setCustomSentences } = useSentences();
  const { showDuplicateError } = useReprioritizeSentence();
  const { add } = useCustomItemWrites(customSentenceStorage, setCustomSentences);

  const openAddSentence = useCallback((values?: { polish?: string; english?: string }) => {
    setInitialValues(values);
    setModalOpen(true);
  }, []);

  // Translatable text reads this context, so a stable value keeps every word from re-rendering.
  const value = useMemo(() => ({ openAddSentence }), [openAddSentence]);

  const handleClose = () => {
    setModalOpen(false);
    setInitialValues(undefined);
  };

  const handleSave = (sentenceData: Omit<Sentence, 'id'>) => {
    const duplicate = findCustomSentenceWithSamePolish(customSentences, sentenceData.polish);
    if (duplicate) {
      showDuplicateError(duplicate.id);
      return false;
    }
    return add(createCustomItem(sentenceData));
  };

  return (
    <AddSentenceContext.Provider value={value}>
      {children}
      <EditSentenceModal
        open={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        sentence={null}
        initialValues={initialValues}
      />
    </AddSentenceContext.Provider>
  );
}

export function useAddSentence() {
  const context = useContext(AddSentenceContext);
  return context;
}

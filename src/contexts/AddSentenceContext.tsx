import { createContext, useState, useCallback, type ReactNode } from 'react';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { loadCustomSentences, saveCustomSentences } from '../lib/storage/customSentences';
import { findCustomSentenceWithSamePolish } from '../lib/utils/findDuplicateCustomSentence';
import type { Sentence, CustomSentence } from '../types/sentences';
import { useSentences } from '../hooks/useReviewData';
import { useReprioritizeSentence } from '../hooks/useReprioritizeSentence';

interface AddSentenceContextType {
  openAddSentence: (initialValues?: { polish?: string; english?: string }) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AddSentenceContext = createContext<AddSentenceContextType | null>(null);

interface AddSentenceProviderProps {
  children: ReactNode;
}

export function AddSentenceProvider({ children }: AddSentenceProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<
    { polish?: string; english?: string } | undefined
  >();
  const { setCustomSentences } = useSentences();
  const { showDuplicateError } = useReprioritizeSentence();

  const openAddSentence = useCallback((values?: { polish?: string; english?: string }) => {
    setInitialValues(values);
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const handleSave = useCallback(
    async (sentenceData: Omit<Sentence, 'id'>) => {
      const loaded = await loadCustomSentences();
      const duplicate = findCustomSentenceWithSamePolish(loaded, sentenceData.polish);
      if (duplicate) {
        showDuplicateError(duplicate.id);
        return false;
      }
      const newSentence: CustomSentence = {
        ...sentenceData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomSentences = [newSentence, ...loaded];
      await saveCustomSentences(newCustomSentences);
      setCustomSentences(newCustomSentences);
      handleClose();
    },
    [setCustomSentences, handleClose, showDuplicateError]
  );

  return (
    <AddSentenceContext.Provider value={{ openAddSentence }}>
      {children}
      <EditSentenceModal
        open={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        sentence={null}
        isCreating
        initialValues={initialValues}
      />
    </AddSentenceContext.Provider>
  );
}

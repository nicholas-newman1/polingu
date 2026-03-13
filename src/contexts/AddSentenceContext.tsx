import { createContext, useState, useCallback, type ReactNode } from 'react';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { loadCustomSentences, saveCustomSentences } from '../lib/storage/customSentences';
import type { Sentence, CustomSentence } from '../types/sentences';
import { useSentences } from '../hooks/useReviewData';

export interface AddSentenceContextType {
  openAddSentence: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AddSentenceContext = createContext<AddSentenceContextType | null>(null);

interface AddSentenceProviderProps {
  children: ReactNode;
}

export function AddSentenceProvider({ children }: AddSentenceProviderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { setCustomSentences } = useSentences();

  const openAddSentence = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleSave = useCallback(
    async (sentenceData: Omit<Sentence, 'id'>) => {
      const newSentence: CustomSentence = {
        ...sentenceData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const loaded = await loadCustomSentences();
      const newCustomSentences = [newSentence, ...loaded];
      await saveCustomSentences(newCustomSentences);
      setCustomSentences(newCustomSentences);
      handleClose();
    },
    [setCustomSentences, handleClose]
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
      />
    </AddSentenceContext.Provider>
  );
}

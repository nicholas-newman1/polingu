import { createContext, useState, useCallback, useRef, type ReactNode } from 'react';
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
  // The saved sentences, read when the dialog opens, so a duplicate is caught
  // synchronously and the dialog stays open with what was typed.
  const savedRef = useRef<CustomSentence[]>([]);
  const { customSentences, setCustomSentences } = useSentences();
  const { showDuplicateError } = useReprioritizeSentence();

  const openAddSentence = useCallback((values?: { polish?: string; english?: string }) => {
    setInitialValues(values);
    setModalOpen(true);
    savedRef.current = [];
    loadCustomSentences().then(
      (loaded) => (savedRef.current = loaded),
      (e) => console.error('Failed to load custom sentences:', e)
    );
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const reportDuplicate = useCallback(
    (sentences: CustomSentence[], polish: string) => {
      const duplicate = findCustomSentenceWithSamePolish(sentences, polish);
      if (duplicate) showDuplicateError(duplicate.id);
      return !!duplicate;
    },
    [showDuplicateError]
  );

  const addSentence = useCallback(
    async (sentenceData: Omit<Sentence, 'id'>) => {
      const loaded = await loadCustomSentences();
      // Checked again in case the save came before the list above had loaded.
      if (reportDuplicate(loaded, sentenceData.polish)) return;
      const newSentence: CustomSentence = {
        ...sentenceData,
        id: `custom_${Date.now()}`,
        isCustom: true,
        createdAt: Date.now(),
      };
      const newCustomSentences = [newSentence, ...loaded];
      await saveCustomSentences(newCustomSentences);
      setCustomSentences(newCustomSentences);
    },
    [setCustomSentences, reportDuplicate]
  );

  const handleSave = useCallback(
    (sentenceData: Omit<Sentence, 'id'>) =>
      // The live list covers sentences the stored copy may not have yet.
      reportDuplicate([...customSentences, ...savedRef.current], sentenceData.polish)
        ? false
        : addSentence(sentenceData),
    [customSentences, reportDuplicate, addSentence]
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

import { createContext, useState, useCallback, type ReactNode } from 'react';
import { EditSentenceModal } from '../components/EditSentenceModal';
import { loadCustomSentences, saveCustomSentences } from '../lib/storage/customSentences';
import { findCustomSentenceWithSamePolish } from '../lib/utils/findDuplicateCustomSentence';
import reprioritizeSentence, { canReprioritizeSentence } from '../lib/storage/reprioritizeSentence';
import type { Sentence, CustomSentence } from '../types/sentences';
import { useSentences } from '../hooks/useReviewData';
import { useSnackbar } from '../hooks/useSnackbar';

export interface AddSentenceContextType {
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
  const { setCustomSentences, sentenceReviewStores, updateSentenceReviewStore } = useSentences();
  const { showSnackbar } = useSnackbar();

  const openAddSentence = useCallback((values?: { polish?: string; english?: string }) => {
    setInitialValues(values);
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setInitialValues(undefined);
  }, []);

  const handleReprioritize = useCallback(
    (sentenceId: string) => {
      const plToEnNext = reprioritizeSentence(sentenceReviewStores['pl-to-en'], sentenceId);
      const enToPlNext = reprioritizeSentence(sentenceReviewStores['en-to-pl'], sentenceId);
      const promises: Promise<void>[] = [];
      if (plToEnNext !== sentenceReviewStores['pl-to-en']) {
        promises.push(updateSentenceReviewStore('pl-to-en', plToEnNext));
      }
      if (enToPlNext !== sentenceReviewStores['en-to-pl']) {
        promises.push(updateSentenceReviewStore('en-to-pl', enToPlNext));
      }
      if (promises.length === 0) return;
      void Promise.all(promises);
      showSnackbar('Sentence queued for review again.', 'success');
    },
    [sentenceReviewStores, updateSentenceReviewStore, showSnackbar]
  );

  const handleSave = useCallback(
    async (sentenceData: Omit<Sentence, 'id'>) => {
      const loaded = await loadCustomSentences();
      const duplicate = findCustomSentenceWithSamePolish(loaded, sentenceData.polish);
      if (duplicate) {
        const reviewable = canReprioritizeSentence(sentenceReviewStores, duplicate.id);
        showSnackbar(
          'This sentence is already in your collection.',
          'error',
          reviewable
            ? {
                action: {
                  label: 'Review again',
                  onClick: () => handleReprioritize(duplicate.id),
                },
              }
            : undefined
        );
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
    [setCustomSentences, handleClose, sentenceReviewStores, handleReprioritize, showSnackbar]
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

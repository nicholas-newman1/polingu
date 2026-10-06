import reprioritizeSentence, { canReprioritizeSentence } from '../lib/storage/reprioritizeSentence';
import { useDirectionalReprioritize } from './useDirectionalReprioritize';
import { useSentences } from './useReviewData';

export function useReprioritizeSentence() {
  const { sentenceReviewStores, updateSentenceReviewStore } = useSentences();
  return useDirectionalReprioritize({
    stores: sentenceReviewStores,
    updateStore: updateSentenceReviewStore,
    reprioritize: reprioritizeSentence,
    canReprioritize: canReprioritizeSentence,
    queuedMessage: 'Sentence queued for review again.',
    duplicateMessage: 'This sentence is already in your collection.',
  });
}

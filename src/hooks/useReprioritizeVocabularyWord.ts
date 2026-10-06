import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
} from '../lib/storage/reprioritizeVocabularyWord';
import { useDirectionalReprioritize } from './useDirectionalReprioritize';
import { useVocabulary } from './useReviewData';

export function useReprioritizeVocabularyWord() {
  const { vocabularyReviewStores, updateVocabularyReviewStore } = useVocabulary();
  return useDirectionalReprioritize({
    stores: vocabularyReviewStores,
    updateStore: updateVocabularyReviewStore,
    reprioritize: reprioritizeVocabularyWord,
    canReprioritize: canReprioritizeVocabularyWord,
    queuedMessage: 'Word queued for review again.',
    duplicateMessage: 'This Polish word is already in your custom vocabulary.',
  });
}

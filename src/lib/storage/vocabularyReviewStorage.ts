import type { VocabularyCardReviewData } from '../../types/vocabulary';
import { createDirectionalReviewStorage } from './createReviewSubcollectionStorage';

export const vocabularyReviewStorage = createDirectionalReviewStorage<VocabularyCardReviewData>({
  'pl-to-en': 'vocabularyReviewCards-pl-en',
  'en-to-pl': 'vocabularyReviewCards-en-pl',
});

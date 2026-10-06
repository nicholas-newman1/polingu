import type { SentenceCardReviewData } from '../../types/sentences';
import { createDirectionalReviewStorage } from './createReviewSubcollectionStorage';

export const sentenceReviewStorage = createDirectionalReviewStorage<SentenceCardReviewData>({
  'pl-to-en': 'sentenceReviewCards-pl-en',
  'en-to-pl': 'sentenceReviewCards-en-pl',
});

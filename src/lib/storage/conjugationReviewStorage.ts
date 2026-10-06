import type { ConjugationFormReviewData } from '../../types/conjugation';
import { createDirectionalReviewStorage } from './createReviewSubcollectionStorage';

export const conjugationReviewStorage = createDirectionalReviewStorage<ConjugationFormReviewData>({
  'pl-to-en': 'conjugationReviewForms-pl-en',
  'en-to-pl': 'conjugationReviewForms-en-pl',
});

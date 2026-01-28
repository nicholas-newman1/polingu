import type { DrillableForm, ConjugationFormReviewData } from '../../types/conjugation';

export interface ConjugationSessionCard {
  form: DrillableForm;
  reviewData: ConjugationFormReviewData;
  isNew: boolean;
}

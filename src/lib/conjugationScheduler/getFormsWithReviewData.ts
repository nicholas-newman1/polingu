import type {
  Verb,
  ConjugationReviewDataStore,
  DrillableForm,
  ConjugationFormReviewData,
} from '../../types/conjugation';
import { getDrillableFormsForVerb } from '../conjugationUtils';
import getOrCreateConjugationFormReviewData from '../storage/getOrCreateConjugationFormReviewData';

export default function getFormsWithReviewData(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore
): { form: DrillableForm; reviewData: ConjugationFormReviewData }[] {
  return verbs.flatMap(getDrillableFormsForVerb).map((form) => ({
    form,
    reviewData: getOrCreateConjugationFormReviewData(form.fullFormKey, reviewStore),
  }));
}

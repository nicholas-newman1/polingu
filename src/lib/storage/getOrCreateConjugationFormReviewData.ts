import { createEmptyCard } from 'ts-fsrs';
import type {
  ConjugationFormKey,
  ConjugationReviewDataStore,
  ConjugationFormReviewData,
} from '../../types/conjugation';

export default function getOrCreateConjugationFormReviewData(
  formKey: ConjugationFormKey,
  store: ConjugationReviewDataStore
): ConjugationFormReviewData {
  const existing = store.forms[formKey];
  if (existing) return existing;

  return {
    formKey,
    fsrsCard: createEmptyCard(),
  };
}

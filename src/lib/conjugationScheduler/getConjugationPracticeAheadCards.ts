import type { Verb, ConjugationReviewDataStore, ConjugationFilters } from '../../types/conjugation';
import { getDrillableFormsForVerb, matchesFilters } from '../conjugationUtils';
import getOrCreateConjugationFormReviewData from '../storage/getOrCreateConjugationFormReviewData';
import { includesFormKey } from '../storage/helpers';
import type { ConjugationSessionCard } from './types';

function sortByDueDate(a: ConjugationSessionCard, b: ConjugationSessionCard): number {
  const dateA = new Date(a.reviewData.fsrsCard.due).getTime();
  const dateB = new Date(b.reviewData.fsrsCard.due).getTime();
  return dateA - dateB;
}

export default function getConjugationPracticeAheadCards(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  filters: ConjugationFilters,
  count: number
): ConjugationSessionCard[] {
  const candidates: ConjugationSessionCard[] = [];

  for (const verb of verbs) {
    const drillableForms = getDrillableFormsForVerb(verb);

    for (const form of drillableForms) {
      if (!matchesFilters(form, filters)) continue;

      const reviewData = getOrCreateConjugationFormReviewData(form.fullFormKey, reviewStore);
      const state = reviewData.fsrsCard.state;
      const isNew = state === 0;
      const isLearning = state === 1 || state === 3;

      if (isNew || isLearning) continue;

      if (includesFormKey(reviewStore.reviewedToday, form.fullFormKey)) {
        continue;
      }

      candidates.push({ form, reviewData, isNew: false });
    }
  }

  candidates.sort(sortByDueDate);

  return candidates.slice(0, count);
}

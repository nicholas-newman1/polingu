import type { Verb, ConjugationReviewDataStore, ConjugationFilters } from '../../types/conjugation';
import { getDrillableFormsForVerb, matchesFilters } from '../conjugationUtils';
import getOrCreateConjugationFormReviewData from '../storage/getOrCreateConjugationFormReviewData';
import { includesFormKey } from '../storage/helpers';
import type { ConjugationSessionCard } from './types';

export default function getConjugationExtraNewCards(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  filters: ConjugationFilters,
  count: number
): ConjugationSessionCard[] {
  const allCards: ConjugationSessionCard[] = [];

  for (const verb of verbs) {
    const drillableForms = getDrillableFormsForVerb(verb);

    for (const form of drillableForms) {
      if (!matchesFilters(form, filters)) continue;

      const reviewData = getOrCreateConjugationFormReviewData(form.fullFormKey, reviewStore);
      const state = reviewData.fsrsCard.state;
      const isNew = state === 0;

      if (isNew && !includesFormKey(reviewStore.newFormsToday, form.fullFormKey)) {
        allCards.push({ form, reviewData, isNew: true });
      }
    }
  }

  return allCards.slice(0, count);
}

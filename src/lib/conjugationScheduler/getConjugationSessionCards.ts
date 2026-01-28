import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationDirectionSettings,
  ConjugationFilters,
} from '../../types/conjugation';
import { getDrillableFormsForVerb, matchesFilters } from '../conjugationUtils';
import getOrCreateConjugationFormReviewData from '../storage/getOrCreateConjugationFormReviewData';
import { includesFormKey } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import type { ConjugationSessionCard } from './types';

function sortByDueDate(a: ConjugationSessionCard, b: ConjugationSessionCard): number {
  const dateA = new Date(a.reviewData.fsrsCard.due).getTime();
  const dateB = new Date(b.reviewData.fsrsCard.due).getTime();
  return dateA - dateB;
}

export default function getConjugationSessionCards(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  filters: ConjugationFilters,
  settings: ConjugationDirectionSettings
): { reviewCards: ConjugationSessionCard[]; newCards: ConjugationSessionCard[] } {
  const reviewCards: ConjugationSessionCard[] = [];
  const newCards: ConjugationSessionCard[] = [];
  const remainingNewFormsToday = settings.newCardsPerDay - reviewStore.newFormsToday.length;

  for (const verb of verbs) {
    const drillableForms = getDrillableFormsForVerb(verb);

    for (const form of drillableForms) {
      const reviewData = getOrCreateConjugationFormReviewData(form.fullFormKey, reviewStore);
      const state = reviewData.fsrsCard.state;
      const isNew = state === 0;
      const isLearning = state === 1 || state === 3;

      if (isNew) {
        if (
          !includesFormKey(reviewStore.newFormsToday, form.fullFormKey) &&
          newCards.length < remainingNewFormsToday &&
          matchesFilters(form, filters)
        ) {
          newCards.push({ form, reviewData, isNew: true });
        }
      } else if (isLearning) {
        if (!includesFormKey(reviewStore.reviewedToday, form.fullFormKey)) {
          reviewCards.push({ form, reviewData, isNew: false });
        }
      } else if (isDue(reviewData.fsrsCard)) {
        if (!includesFormKey(reviewStore.reviewedToday, form.fullFormKey)) {
          reviewCards.push({ form, reviewData, isNew: false });
        }
      }
    }
  }

  reviewCards.sort(sortByDueDate);

  return { reviewCards, newCards };
}

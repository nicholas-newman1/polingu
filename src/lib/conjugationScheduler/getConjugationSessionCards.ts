import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationDirectionSettings,
  ConjugationFilters,
} from '../../types/conjugation';
import { matchesFilters } from '../conjugationUtils';
import { includesFormKey } from '../storage/helpers';
import getReviewBucket from '../fsrsUtils/getReviewBucket';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import getFormsWithReviewData from './getFormsWithReviewData';
import type { ConjugationSessionCard } from './types';

export default function getConjugationSessionCards(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  filters: ConjugationFilters,
  settings: ConjugationDirectionSettings
): { reviewCards: ConjugationSessionCard[]; newCards: ConjugationSessionCard[] } {
  const reviewCards: ConjugationSessionCard[] = [];
  const allNewCards: ConjugationSessionCard[] = [];
  const remainingNewFormsToday = settings.newCardsPerDay - reviewStore.newFormsToday.length;

  for (const { form, reviewData } of getFormsWithReviewData(verbs, reviewStore)) {
    const bucket = getReviewBucket(
      reviewData.fsrsCard,
      includesFormKey(reviewStore.newFormsToday, form.fullFormKey),
      includesFormKey(reviewStore.reviewedToday, form.fullFormKey)
    );

    if (bucket === 'new' && matchesFilters(form, filters)) {
      allNewCards.push({ form, reviewData, isNew: true });
    } else if (bucket === 'review') {
      reviewCards.push({ form, reviewData, isNew: false });
    }
  }

  reviewCards.sort(sortByDueDate);
  const newCards = allNewCards.slice(0, remainingNewFormsToday);

  return { reviewCards, newCards };
}

import type { Verb, ConjugationReviewDataStore, ConjugationFilters } from '../../types/conjugation';
import { matchesFilters } from '../conjugationUtils';
import { includesFormKey } from '../storage/helpers';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import getFormsWithReviewData from './getFormsWithReviewData';
import type { ConjugationSessionCard } from './types';

const REVIEW_STATE = 2;

/** Getters for cards beyond today's session: practicing mastered forms ahead, or extra new forms. */
export default function getConjugationExtraCards(
  verbs: Verb[],
  reviewStore: ConjugationReviewDataStore,
  filters: ConjugationFilters
) {
  const matching = () =>
    getFormsWithReviewData(verbs, reviewStore).filter(({ form }) => matchesFilters(form, filters));

  return {
    getPracticeAheadCards: (count: number): ConjugationSessionCard[] =>
      matching()
        .filter(
          ({ form, reviewData }) =>
            reviewData.fsrsCard.state === REVIEW_STATE &&
            !includesFormKey(reviewStore.reviewedToday, form.fullFormKey)
        )
        .map((card) => ({ ...card, isNew: false }))
        .sort(sortByDueDate)
        .slice(0, count),

    getExtraNewCards: (count: number): ConjugationSessionCard[] =>
      matching()
        .filter(
          ({ form, reviewData }) =>
            reviewData.fsrsCard.state === 0 &&
            !includesFormKey(reviewStore.newFormsToday, form.fullFormKey)
        )
        .map((card) => ({ ...card, isNew: true }))
        .slice(0, count),
  };
}

import type { DeclensionCard, DeclensionReviewDataStore } from '../../types';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import { includesDeclensionCardId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import shuffleArray from '../utils/shuffleArray';
import type { DeclensionFilters, DeclensionSessionCard } from './types';
import matchesDeclensionFilters from './matchesFilters';

/** Getters for cards beyond today's session. Custom cards always come before system cards. */
export default function getDeclensionExtraCards(
  allCards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  filters: DeclensionFilters
) {
  const pick = (include: (card: DeclensionSessionCard) => boolean, isNew: boolean) => {
    const custom: DeclensionSessionCard[] = [];
    const system: DeclensionSessionCard[] = [];
    for (const card of allCards) {
      if (!matchesDeclensionFilters(card, filters)) continue;
      const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
      const sessionCard = { card, reviewData, isNew };
      if (include(sessionCard)) (card.isCustom ? custom : system).push(sessionCard);
    }
    return { custom, system };
  };

  return {
    getPracticeAheadCards: (count: number): DeclensionSessionCard[] => {
      const { custom, system } = pick(
        ({ card, reviewData }) =>
          reviewData.fsrsCard.state !== 0 &&
          (!isDue(reviewData.fsrsCard) ||
            includesDeclensionCardId(reviewStore.reviewedToday, card.id)),
        false
      );
      return [...custom.sort(sortByDueDate), ...system.sort(sortByDueDate)].slice(0, count);
    },

    getExtraNewCards: (count: number): DeclensionSessionCard[] => {
      const { custom, system } = pick(
        ({ card, reviewData }) =>
          reviewData.fsrsCard.state === 0 &&
          !includesDeclensionCardId(reviewStore.newCardsToday, card.id),
        true
      );
      return [...shuffleArray(custom), ...shuffleArray(system)].slice(0, count);
    },
  };
}

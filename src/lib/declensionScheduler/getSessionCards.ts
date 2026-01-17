import type { DeclensionCard, DeclensionReviewDataStore, DeclensionSettings } from '../../types';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import { includesDeclensionCardId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { DeclensionFilters, DeclensionSessionCard } from './types';
import matchesDeclensionFilters from './matchesFilters';

export default function getDeclensionSessionCards(
  allCards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  filters: DeclensionFilters,
  settings: DeclensionSettings
): { reviewCards: DeclensionSessionCard[]; newCards: DeclensionSessionCard[] } {
  const customReviewCards: DeclensionSessionCard[] = [];
  const customNewCards: DeclensionSessionCard[] = [];
  const systemReviewCards: DeclensionSessionCard[] = [];
  const systemNewCards: DeclensionSessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of allCards) {
    const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;
    const isCustom = card.isCustom === true;
    const targetNewCards = isCustom ? customNewCards : systemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (isNew) {
      if (
        matchesDeclensionFilters(card, filters) &&
        !includesDeclensionCardId(reviewStore.newCardsToday, card.id) &&
        customNewCards.length + systemNewCards.length < remainingNewCardsToday
      ) {
        targetNewCards.push({ card, reviewData, isNew: true });
      }
    } else if (isLearning) {
      if (!includesDeclensionCardId(reviewStore.reviewedToday, card.id)) {
        targetReviewCards.push({ card, reviewData, isNew: false });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesDeclensionCardId(reviewStore.reviewedToday, card.id)) {
        targetReviewCards.push({ card, reviewData, isNew: false });
      }
    }
  }

  customReviewCards.sort(sortByDueDate);
  systemReviewCards.sort(sortByDueDate);

  return {
    reviewCards: [...customReviewCards, ...systemReviewCards],
    newCards: [...customNewCards, ...systemNewCards],
  };
}

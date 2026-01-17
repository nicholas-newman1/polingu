import type { DeclensionCard, DeclensionReviewDataStore } from '../../types';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import { includesDeclensionCardId } from '../storage/helpers';
import type { DeclensionFilters, DeclensionSessionCard } from './types';
import matchesDeclensionFilters from './matchesFilters';

export default function getDeclensionExtraNewCards(
  allCards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  filters: DeclensionFilters,
  count: number
): DeclensionSessionCard[] {
  const customNewCards: DeclensionSessionCard[] = [];
  const systemNewCards: DeclensionSessionCard[] = [];

  for (const card of allCards) {
    if (!matchesDeclensionFilters(card, filters)) continue;

    const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew && !includesDeclensionCardId(reviewStore.newCardsToday, card.id)) {
      const targetCards = card.isCustom ? customNewCards : systemNewCards;
      targetCards.push({ card, reviewData, isNew: true });
      if (customNewCards.length + systemNewCards.length >= count) break;
    }
  }

  return [...customNewCards, ...systemNewCards];
}

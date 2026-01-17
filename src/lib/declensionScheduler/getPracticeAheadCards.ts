import type { DeclensionCard, DeclensionReviewDataStore } from '../../types';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import { includesDeclensionCardId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { DeclensionFilters, DeclensionSessionCard } from './types';
import matchesDeclensionFilters from './matchesFilters';

export default function getDeclensionPracticeAheadCards(
  allCards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  filters: DeclensionFilters,
  count: number
): DeclensionSessionCard[] {
  const customPracticeCards: DeclensionSessionCard[] = [];
  const systemPracticeCards: DeclensionSessionCard[] = [];

  for (const card of allCards) {
    if (!matchesDeclensionFilters(card, filters)) continue;

    const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) continue;

    const isDueCard = isDue(reviewData.fsrsCard);
    const reviewedToday = includesDeclensionCardId(reviewStore.reviewedToday, card.id);

    if (!isDueCard || reviewedToday) {
      const targetCards = card.isCustom
        ? customPracticeCards
        : systemPracticeCards;
      targetCards.push({ card, reviewData, isNew: false });
    }
  }

  customPracticeCards.sort(sortByDueDate);
  systemPracticeCards.sort(sortByDueDate);

  return [...customPracticeCards, ...systemPracticeCards].slice(0, count);
}

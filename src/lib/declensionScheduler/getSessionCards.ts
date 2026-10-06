import type { DeclensionCard, DeclensionReviewDataStore, DeclensionSettings } from '../../types';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import { includesDeclensionCardId } from '../storage/helpers';
import getReviewBucket from '../fsrsUtils/getReviewBucket';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import shuffleArray from '../utils/shuffleArray';
import type { DeclensionFilters, DeclensionSessionCard } from './types';
import matchesDeclensionFilters from './matchesFilters';

export default function getDeclensionSessionCards(
  allCards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  filters: DeclensionFilters,
  settings: DeclensionSettings
): { reviewCards: DeclensionSessionCard[]; newCards: DeclensionSessionCard[] } {
  const customReviewCards: DeclensionSessionCard[] = [];
  const allCustomNewCards: DeclensionSessionCard[] = [];
  const systemReviewCards: DeclensionSessionCard[] = [];
  const allSystemNewCards: DeclensionSessionCard[] = [];
  const remainingNewCardsToday = settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of allCards) {
    const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
    const bucket = getReviewBucket(
      reviewData.fsrsCard,
      includesDeclensionCardId(reviewStore.newCardsToday, card.id),
      includesDeclensionCardId(reviewStore.reviewedToday, card.id)
    );
    const isCustom = card.isCustom === true;
    const targetNewCards = isCustom ? allCustomNewCards : allSystemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (bucket === 'new' && matchesDeclensionFilters(card, filters)) {
      targetNewCards.push({ card, reviewData, isNew: true });
    } else if (bucket === 'review') {
      targetReviewCards.push({ card, reviewData, isNew: false });
    }
  }

  customReviewCards.sort(sortByDueDate);
  systemReviewCards.sort(sortByDueDate);

  const shuffledCustomNew = shuffleArray(allCustomNewCards);
  const shuffledSystemNew = shuffleArray(allSystemNewCards);
  const newCards = [...shuffledCustomNew, ...shuffledSystemNew].slice(0, remainingNewCardsToday);

  return {
    reviewCards: [...customReviewCards, ...systemReviewCards],
    newCards,
  };
}

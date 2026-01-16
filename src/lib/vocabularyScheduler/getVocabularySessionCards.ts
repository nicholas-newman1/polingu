import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
} from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { VocabularySessionCard } from './types';

export default function getVocabularySessionCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularySettings
): { reviewCards: VocabularySessionCard[]; newCards: VocabularySessionCard[] } {
  const customReviewCards: VocabularySessionCard[] = [];
  const customNewCards: VocabularySessionCard[] = [];
  const systemReviewCards: VocabularySessionCard[] = [];
  const systemNewCards: VocabularySessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;
    const isCustom = word.isCustom === true;
    const targetNewCards = isCustom ? customNewCards : systemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (isNew) {
      if (
        !includesWordId(reviewStore.newCardsToday, word.id) &&
        (customNewCards.length + systemNewCards.length) < remainingNewCardsToday
      ) {
        targetNewCards.push({ word, reviewData, isNew: true });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesWordId(reviewStore.reviewedToday, word.id)) {
        targetReviewCards.push({ word, reviewData, isNew: false });
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


import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
} from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { VocabularySessionCard } from './types';

export default function getVocabularySessionCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularySettings
): { reviewCards: VocabularySessionCard[]; newCards: VocabularySessionCard[] } {
  const reviewCards: VocabularySessionCard[] = [];
  const newCards: VocabularySessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) {
      if (
        !reviewStore.newCardsToday.includes(word.id) &&
        newCards.length < remainingNewCardsToday
      ) {
        newCards.push({ word, reviewData, isNew: true });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!reviewStore.reviewedToday.includes(word.id)) {
        reviewCards.push({ word, reviewData, isNew: false });
      }
    }
  }

  reviewCards.sort(sortByDueDate);

  return { reviewCards, newCards };
}


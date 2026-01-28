import type { VocabularyWord, VocabularyReviewDataStore } from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { VocabularySessionCard } from './types';

export default function getVocabularyPracticeAheadCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  count: number
): VocabularySessionCard[] {
  const practiceCards: VocabularySessionCard[] = [];

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(word.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) continue;

    const isDueCard = isDue(reviewData.fsrsCard);
    const reviewedToday = includesWordId(reviewStore.reviewedToday, word.id);

    if (!isDueCard || reviewedToday) {
      practiceCards.push({ word, reviewData, isNew: false });
    }
  }

  practiceCards.sort(sortByDueDate);

  return practiceCards.slice(0, count);
}

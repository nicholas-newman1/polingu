import type { VocabularyWord, VocabularyReviewDataStore } from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import isPracticeAheadCandidate from '../fsrsUtils/isPracticeAheadCandidate';
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
    const reviewedToday = includesWordId(reviewStore.reviewedToday, word.id);
    if (!isPracticeAheadCandidate(reviewData.fsrsCard, reviewedToday)) continue;

    practiceCards.push({ word, reviewData, isNew: false });
  }

  practiceCards.sort(sortByDueDate);

  return practiceCards.slice(0, count);
}

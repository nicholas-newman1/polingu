import type {
  VocabularyWord,
  VocabularyReviewDataStore,
} from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import type { VocabularySessionCard } from './types';

export default function getVocabularyExtraNewCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  count: number
): VocabularySessionCard[] {
  const newCards: VocabularySessionCard[] = [];

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew && !includesWordId(reviewStore.newCardsToday, word.id)) {
      newCards.push({ word, reviewData, isNew: true });
      if (newCards.length >= count) break;
    }
  }

  return newCards;
}

import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularyDirectionSettings,
} from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import getReviewBucket from '../fsrsUtils/getReviewBucket';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { VocabularySessionCard } from './types';

export default function getVocabularySessionCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularyDirectionSettings
): { reviewCards: VocabularySessionCard[]; newCards: VocabularySessionCard[] } {
  const customReviewCards: VocabularySessionCard[] = [];
  const customNewCards: VocabularySessionCard[] = [];
  const systemReviewCards: VocabularySessionCard[] = [];
  const systemNewCards: VocabularySessionCard[] = [];
  const remainingNewCardsToday = settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(word.id, reviewStore);
    const bucket = getReviewBucket(
      reviewData.fsrsCard,
      includesWordId(reviewStore.newCardsToday, word.id),
      includesWordId(reviewStore.reviewedToday, word.id)
    );
    const isCustom = word.isCustom === true;
    const targetNewCards = isCustom ? customNewCards : systemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (bucket === 'new' && customNewCards.length + systemNewCards.length < remainingNewCardsToday) {
      targetNewCards.push({ word, reviewData, isNew: true });
    } else if (bucket === 'review') {
      targetReviewCards.push({ word, reviewData, isNew: false });
    }
  }

  customReviewCards.sort(sortByDueDate);
  systemReviewCards.sort(sortByDueDate);

  return {
    reviewCards: [...customReviewCards, ...systemReviewCards],
    newCards: [...customNewCards, ...systemNewCards],
  };
}

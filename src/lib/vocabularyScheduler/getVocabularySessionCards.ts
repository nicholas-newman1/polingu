import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularyDirectionSettings,
} from '../../types/vocabulary';
import getOrCreateVocabularyCardReviewData from '../storage/getOrCreateVocabularyCardReviewData';
import { includesWordId } from '../storage/helpers';
import getReviewBucket from '../fsrsUtils/getReviewBucket';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import prioritizeNewCards from './prioritizeNewCards';
import type { VocabularySessionCard } from './types';

export default function getVocabularySessionCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularyDirectionSettings
): { reviewCards: VocabularySessionCard[]; newCards: VocabularySessionCard[] } {
  const customReviewCards: VocabularySessionCard[] = [];
  const systemReviewCards: VocabularySessionCard[] = [];
  const newCandidates: VocabularySessionCard[] = [];
  const remainingNewCardsToday = settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(word.id, reviewStore);
    const bucket = getReviewBucket(
      reviewData.fsrsCard,
      includesWordId(reviewStore.newCardsToday, word.id),
      includesWordId(reviewStore.reviewedToday, word.id)
    );
    if (bucket === 'new') {
      newCandidates.push({ word, reviewData, isNew: true });
    } else if (bucket === 'review') {
      const isCustom = word.isCustom === true;
      (isCustom ? customReviewCards : systemReviewCards).push({ word, reviewData, isNew: false });
    }
  }

  const todaysNew = prioritizeNewCards(newCandidates).slice(0, Math.max(0, remainingNewCardsToday));
  const prioritizedNew = todaysNew.filter((card) => card.reviewData.prioritizedAt !== undefined);
  const otherNew = todaysNew.filter((card) => card.reviewData.prioritizedAt === undefined);

  customReviewCards.sort(sortByDueDate);
  systemReviewCards.sort(sortByDueDate);

  return {
    reviewCards: [...customReviewCards, ...systemReviewCards],
    newCards: [
      ...prioritizedNew,
      ...otherNew.filter((card) => card.word.isCustom === true),
      ...otherNew.filter((card) => card.word.isCustom !== true),
    ],
  };
}

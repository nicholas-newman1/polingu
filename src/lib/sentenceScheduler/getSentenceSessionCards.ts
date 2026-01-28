import type {
  Sentence,
  SentenceReviewDataStore,
  SentenceDirectionSettings,
} from '../../types/sentences';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import { includesSentenceId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { SentenceSessionCard } from './types';

export default function getSentenceSessionCards(
  allSentences: Sentence[],
  reviewStore: SentenceReviewDataStore,
  settings: SentenceDirectionSettings
): { reviewCards: SentenceSessionCard[]; newCards: SentenceSessionCard[] } {
  const customReviewCards: SentenceSessionCard[] = [];
  const customNewCards: SentenceSessionCard[] = [];
  const systemReviewCards: SentenceSessionCard[] = [];
  const systemNewCards: SentenceSessionCard[] = [];
  const remainingNewCardsToday = settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const sentence of allSentences) {
    const reviewData = getOrCreateSentenceCardReviewData(sentence.id, reviewStore);
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;
    const isCustom = sentence.isCustom === true;
    const targetNewCards = isCustom ? customNewCards : systemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (isNew) {
      if (
        !includesSentenceId(reviewStore.newCardsToday, sentence.id) &&
        customNewCards.length + systemNewCards.length < remainingNewCardsToday
      ) {
        targetNewCards.push({ sentence, reviewData, isNew: true });
      }
    } else if (isLearning) {
      if (!includesSentenceId(reviewStore.reviewedToday, sentence.id)) {
        targetReviewCards.push({ sentence, reviewData, isNew: false });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesSentenceId(reviewStore.reviewedToday, sentence.id)) {
        targetReviewCards.push({ sentence, reviewData, isNew: false });
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

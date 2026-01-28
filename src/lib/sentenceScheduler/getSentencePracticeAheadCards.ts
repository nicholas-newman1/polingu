import type { Sentence, SentenceReviewDataStore } from '../../types/sentences';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import { includesSentenceId } from '../storage/helpers';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { SentenceSessionCard } from './types';

export default function getSentencePracticeAheadCards(
  allSentences: Sentence[],
  reviewStore: SentenceReviewDataStore,
  count: number
): SentenceSessionCard[] {
  const customPracticeCards: SentenceSessionCard[] = [];
  const systemPracticeCards: SentenceSessionCard[] = [];

  for (const sentence of allSentences) {
    const reviewData = getOrCreateSentenceCardReviewData(sentence.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) continue;

    const isDueCard = isDue(reviewData.fsrsCard);
    const reviewedToday = includesSentenceId(reviewStore.reviewedToday, sentence.id);

    if (!isDueCard || reviewedToday) {
      const isCustom = sentence.isCustom === true;
      if (isCustom) {
        customPracticeCards.push({ sentence, reviewData, isNew: false });
      } else {
        systemPracticeCards.push({ sentence, reviewData, isNew: false });
      }
    }
  }

  customPracticeCards.sort(sortByDueDate);
  systemPracticeCards.sort(sortByDueDate);

  return [...customPracticeCards, ...systemPracticeCards].slice(0, count);
}

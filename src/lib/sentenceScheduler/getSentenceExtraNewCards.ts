import type { Sentence, SentenceReviewDataStore } from '../../types/sentences';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import { includesSentenceId } from '../storage/helpers';
import type { SentenceSessionCard } from './types';

export default function getSentenceExtraNewCards(
  allSentences: Sentence[],
  reviewStore: SentenceReviewDataStore,
  count: number
): SentenceSessionCard[] {
  const customNewCards: SentenceSessionCard[] = [];
  const systemNewCards: SentenceSessionCard[] = [];

  for (const sentence of allSentences) {
    const reviewData = getOrCreateSentenceCardReviewData(sentence.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew && !includesSentenceId(reviewStore.newCardsToday, sentence.id)) {
      const isCustom = sentence.isCustom === true;
      if (isCustom) {
        customNewCards.push({ sentence, reviewData, isNew: true });
      } else {
        systemNewCards.push({ sentence, reviewData, isNew: true });
      }
      if (customNewCards.length + systemNewCards.length >= count) break;
    }
  }

  return [...customNewCards, ...systemNewCards].slice(0, count);
}

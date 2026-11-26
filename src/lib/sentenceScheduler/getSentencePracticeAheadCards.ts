import type { Sentence, SentenceReviewDataStore } from '../../types/sentences';
import getOrCreateSentenceCardReviewData from '../storage/getOrCreateSentenceCardReviewData';
import { includesSentenceId } from '../storage/helpers';
import isPracticeAheadCandidate from '../fsrsUtils/isPracticeAheadCandidate';
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
    const reviewedToday = includesSentenceId(reviewStore.reviewedToday, sentence.id);
    if (!isPracticeAheadCandidate(reviewData.fsrsCard, reviewedToday)) continue;

    const isCustom = sentence.isCustom === true;
    if (isCustom) {
      customPracticeCards.push({ sentence, reviewData, isNew: false });
    } else {
      systemPracticeCards.push({ sentence, reviewData, isNew: false });
    }
  }

  customPracticeCards.sort(sortByDueDate);
  systemPracticeCards.sort(sortByDueDate);

  return [...customPracticeCards, ...systemPracticeCards].slice(0, count);
}

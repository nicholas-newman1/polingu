import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { getDefaultSentenceReviewStore, getSentenceSessionDocPath } from './helpers';
import { sentenceReviewStorage } from './sentenceReviewStorage';
import loadDailyReviewSession from './loadDailyReviewSession';
import type { SessionChanges } from '../../types/common';

export default async function loadSentenceReviewData(
  direction: TranslationDirection
): Promise<SentenceReviewDataStore> {
  const { reviewedToday, newCardsToday, lastReviewDate } = getDefaultSentenceReviewStore();
  const [cards, session] = await loadDailyReviewSession(
    sentenceReviewStorage(direction),
    getSentenceSessionDocPath(direction),
    {
      reviewedToday,
      newCardsToday,
      lastReviewDate,
      changedAt: undefined as SessionChanges | undefined,
    }
  );

  return {
    cards,
    reviewedToday: session.reviewedToday,
    newCardsToday: session.newCardsToday,
    lastReviewDate: session.lastReviewDate,
    ...(session.changedAt ? { changedAt: session.changedAt } : {}),
  };
}

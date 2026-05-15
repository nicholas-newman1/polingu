import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { getSentenceSessionDocPath } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { sentenceReviewStorage } from './sentenceReviewStorage';

interface SentenceReviewSession {
  reviewedToday: SentenceReviewDataStore['reviewedToday'];
  newCardsToday: SentenceReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function saveSentenceReviewData(
  prev: SentenceReviewDataStore | null,
  next: SentenceReviewDataStore,
  direction: TranslationDirection
): Promise<void> {
  const storage = sentenceReviewStorage(direction);
  const session: SentenceReviewSession = {
    reviewedToday: next.reviewedToday,
    newCardsToday: next.newCardsToday,
    lastReviewDate: next.lastReviewDate,
  };
  await Promise.all([
    storage.saveCardsDiff(prev?.cards ?? null, next.cards),
    saveUserData(getSentenceSessionDocPath(direction), session),
  ]);
}

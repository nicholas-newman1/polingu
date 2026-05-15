import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import {
  getTodayString,
  getDefaultSentenceReviewStore,
  getSentenceSessionDocPath,
} from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { sentenceReviewStorage } from './sentenceReviewStorage';

interface SentenceReviewSession {
  reviewedToday: SentenceReviewDataStore['reviewedToday'];
  newCardsToday: SentenceReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function loadSentenceReviewData(
  direction: TranslationDirection
): Promise<SentenceReviewDataStore> {
  const storage = sentenceReviewStorage(direction);
  const today = getTodayString();
  const defaults = getDefaultSentenceReviewStore();
  const defaultSession: SentenceReviewSession = {
    reviewedToday: defaults.reviewedToday,
    newCardsToday: defaults.newCardsToday,
    lastReviewDate: defaults.lastReviewDate,
  };

  const [cards, session] = await Promise.all([
    storage.loadCards(),
    loadUserData<SentenceReviewSession>(getSentenceSessionDocPath(direction), defaultSession),
  ]);

  if (session.lastReviewDate !== today) {
    session.reviewedToday = [];
    session.newCardsToday = [];
    session.lastReviewDate = today;
  }

  return {
    cards,
    reviewedToday: session.reviewedToday,
    newCardsToday: session.newCardsToday,
    lastReviewDate: session.lastReviewDate,
  };
}

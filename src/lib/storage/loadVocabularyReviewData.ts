import type { VocabularyReviewDataStore } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import {
  getTodayString,
  getDefaultVocabularyReviewStore,
  getVocabularySessionDocPath,
} from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';

interface VocabularyReviewSession {
  reviewedToday: VocabularyReviewDataStore['reviewedToday'];
  newCardsToday: VocabularyReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function loadVocabularyReviewData(
  direction: TranslationDirection
): Promise<VocabularyReviewDataStore> {
  const storage = vocabularyReviewStorage(direction);
  const today = getTodayString();
  const defaults = getDefaultVocabularyReviewStore();
  const defaultSession: VocabularyReviewSession = {
    reviewedToday: defaults.reviewedToday,
    newCardsToday: defaults.newCardsToday,
    lastReviewDate: defaults.lastReviewDate,
  };

  const [cards, session] = await Promise.all([
    storage.loadCards(),
    loadUserData<VocabularyReviewSession>(getVocabularySessionDocPath(direction), defaultSession),
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

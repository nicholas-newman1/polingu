import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import {
  getTodayString,
  getDefaultAspectPairsReviewStore,
  ASPECT_PAIRS_SESSION_DOC_PATH,
} from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';

interface AspectPairsReviewSession {
  reviewedToday: AspectPairsReviewDataStore['reviewedToday'];
  newCardsToday: AspectPairsReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function loadAspectPairsReviewData(): Promise<AspectPairsReviewDataStore> {
  const today = getTodayString();
  const defaults = getDefaultAspectPairsReviewStore();
  const defaultSession: AspectPairsReviewSession = {
    reviewedToday: defaults.reviewedToday,
    newCardsToday: defaults.newCardsToday,
    lastReviewDate: defaults.lastReviewDate,
  };

  const [cards, session] = await Promise.all([
    aspectPairsReviewStorage.loadCards(),
    loadUserData<AspectPairsReviewSession>(ASPECT_PAIRS_SESSION_DOC_PATH, defaultSession),
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

import type { DeclensionReviewDataStore } from '../../types';
import {
  getTodayString,
  getDefaultDeclensionReviewStore,
  DECLENSION_SESSION_DOC_PATH,
} from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { declensionReviewStorage } from './declensionReviewStorage';

interface DeclensionReviewSession {
  reviewedToday: DeclensionReviewDataStore['reviewedToday'];
  newCardsToday: DeclensionReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function loadDeclensionReviewData(): Promise<DeclensionReviewDataStore> {
  const today = getTodayString();
  const defaults = getDefaultDeclensionReviewStore();
  const defaultSession: DeclensionReviewSession = {
    reviewedToday: defaults.reviewedToday,
    newCardsToday: defaults.newCardsToday,
    lastReviewDate: defaults.lastReviewDate,
  };

  const [cards, session] = await Promise.all([
    declensionReviewStorage.loadCards(),
    loadUserData<DeclensionReviewSession>(DECLENSION_SESSION_DOC_PATH, defaultSession),
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

import type { ConjugationReviewDataStore } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import {
  getTodayString,
  getDefaultConjugationReviewStore,
  getConjugationSessionDocPath,
} from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { conjugationReviewStorage } from './conjugationReviewStorage';

interface ConjugationReviewSession {
  reviewedToday: ConjugationReviewDataStore['reviewedToday'];
  newFormsToday: ConjugationReviewDataStore['newFormsToday'];
  lastReviewDate: string;
}

export default async function loadConjugationReviewData(
  direction: TranslationDirection
): Promise<ConjugationReviewDataStore> {
  const storage = conjugationReviewStorage(direction);
  const today = getTodayString();
  const defaults = getDefaultConjugationReviewStore();
  const defaultSession: ConjugationReviewSession = {
    reviewedToday: defaults.reviewedToday,
    newFormsToday: defaults.newFormsToday,
    lastReviewDate: defaults.lastReviewDate,
  };

  const [forms, session] = await Promise.all([
    storage.loadCards(),
    loadUserData<ConjugationReviewSession>(getConjugationSessionDocPath(direction), defaultSession),
  ]);

  if (session.lastReviewDate !== today) {
    session.reviewedToday = [];
    session.newFormsToday = [];
    session.lastReviewDate = today;
  }

  return {
    forms,
    reviewedToday: session.reviewedToday,
    newFormsToday: session.newFormsToday,
    lastReviewDate: session.lastReviewDate,
  };
}

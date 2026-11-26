import type { ConjugationReviewDataStore } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getDefaultConjugationReviewStore, getConjugationSessionDocPath } from './helpers';
import { conjugationReviewStorage } from './conjugationReviewStorage';
import loadDailyReviewSession from './loadDailyReviewSession';
import type { SessionChanges } from '../../types/common';

export default async function loadConjugationReviewData(
  direction: TranslationDirection
): Promise<ConjugationReviewDataStore> {
  const { reviewedToday, newFormsToday, lastReviewDate } = getDefaultConjugationReviewStore();
  const [forms, session] = await loadDailyReviewSession(
    conjugationReviewStorage(direction),
    getConjugationSessionDocPath(direction),
    {
      reviewedToday,
      newFormsToday,
      lastReviewDate,
      changedAt: undefined as SessionChanges | undefined,
    }
  );

  return {
    forms,
    reviewedToday: session.reviewedToday,
    newFormsToday: session.newFormsToday,
    lastReviewDate: session.lastReviewDate,
    ...(session.changedAt ? { changedAt: session.changedAt } : {}),
  };
}

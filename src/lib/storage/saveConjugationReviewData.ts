import type { ConjugationReviewDataStore } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getConjugationSessionDocPath } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { conjugationReviewStorage } from './conjugationReviewStorage';
import type { SessionChanges } from '../../types/common';

interface ConjugationReviewSession {
  reviewedToday: ConjugationReviewDataStore['reviewedToday'];
  newFormsToday: ConjugationReviewDataStore['newFormsToday'];
  lastReviewDate: string;
  changedAt?: SessionChanges;
}

export default async function saveConjugationReviewData(
  prev: ConjugationReviewDataStore | null,
  next: ConjugationReviewDataStore,
  direction: TranslationDirection
): Promise<void> {
  const storage = conjugationReviewStorage(direction);
  const session: ConjugationReviewSession = {
    reviewedToday: next.reviewedToday,
    newFormsToday: next.newFormsToday,
    lastReviewDate: next.lastReviewDate,
    ...(next.changedAt ? { changedAt: next.changedAt } : {}),
  };
  await Promise.all([
    storage.saveCardsDiff(prev?.forms ?? null, next.forms),
    saveUserData(getConjugationSessionDocPath(direction), session),
  ]);
}

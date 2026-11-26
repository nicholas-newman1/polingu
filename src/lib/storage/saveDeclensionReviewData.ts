import type { DeclensionReviewDataStore } from '../../types';
import { DECLENSION_SESSION_DOC_PATH } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { declensionReviewStorage } from './declensionReviewStorage';
import type { SessionChanges } from '../../types/common';

interface DeclensionReviewSession {
  reviewedToday: DeclensionReviewDataStore['reviewedToday'];
  newCardsToday: DeclensionReviewDataStore['newCardsToday'];
  lastReviewDate: string;
  changedAt?: SessionChanges;
}

export default async function saveDeclensionReviewData(
  prev: DeclensionReviewDataStore | null,
  next: DeclensionReviewDataStore
): Promise<void> {
  const session: DeclensionReviewSession = {
    reviewedToday: next.reviewedToday,
    newCardsToday: next.newCardsToday,
    lastReviewDate: next.lastReviewDate,
    ...(next.changedAt ? { changedAt: next.changedAt } : {}),
  };
  await Promise.all([
    declensionReviewStorage.saveCardsDiff(prev?.cards ?? null, next.cards),
    saveUserData(DECLENSION_SESSION_DOC_PATH, session),
  ]);
}

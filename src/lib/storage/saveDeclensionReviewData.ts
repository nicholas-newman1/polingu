import type { DeclensionReviewDataStore } from '../../types';
import { DECLENSION_SESSION_DOC_PATH } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { declensionReviewStorage } from './declensionReviewStorage';

interface DeclensionReviewSession {
  reviewedToday: DeclensionReviewDataStore['reviewedToday'];
  newCardsToday: DeclensionReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function saveDeclensionReviewData(
  prev: DeclensionReviewDataStore | null,
  next: DeclensionReviewDataStore
): Promise<void> {
  const session: DeclensionReviewSession = {
    reviewedToday: next.reviewedToday,
    newCardsToday: next.newCardsToday,
    lastReviewDate: next.lastReviewDate,
  };
  await Promise.all([
    declensionReviewStorage.saveCardsDiff(prev?.cards ?? null, next.cards),
    saveUserData(DECLENSION_SESSION_DOC_PATH, session),
  ]);
}

import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { ASPECT_PAIRS_SESSION_DOC_PATH } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';
import type { SessionChanges } from '../../types/common';

interface AspectPairsReviewSession {
  reviewedToday: AspectPairsReviewDataStore['reviewedToday'];
  newCardsToday: AspectPairsReviewDataStore['newCardsToday'];
  lastReviewDate: string;
  changedAt?: SessionChanges;
}

export default async function saveAspectPairsReviewData(
  prev: AspectPairsReviewDataStore | null,
  next: AspectPairsReviewDataStore
): Promise<void> {
  const session: AspectPairsReviewSession = {
    reviewedToday: next.reviewedToday,
    newCardsToday: next.newCardsToday,
    lastReviewDate: next.lastReviewDate,
    ...(next.changedAt ? { changedAt: next.changedAt } : {}),
  };
  await Promise.all([
    aspectPairsReviewStorage.saveCardsDiff(prev?.cards ?? null, next.cards),
    saveUserData(ASPECT_PAIRS_SESSION_DOC_PATH, session),
  ]);
}

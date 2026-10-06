import type { DeclensionReviewDataStore } from '../../types';
import { getDefaultDeclensionReviewStore, DECLENSION_SESSION_DOC_PATH } from './helpers';
import { declensionReviewStorage } from './declensionReviewStorage';
import loadDailyReviewSession from './loadDailyReviewSession';

export default async function loadDeclensionReviewData(): Promise<DeclensionReviewDataStore> {
  const { reviewedToday, newCardsToday, lastReviewDate } = getDefaultDeclensionReviewStore();
  const [cards, session] = await loadDailyReviewSession(
    declensionReviewStorage,
    DECLENSION_SESSION_DOC_PATH,
    {
      reviewedToday,
      newCardsToday,
      lastReviewDate,
    }
  );

  return {
    cards,
    reviewedToday: session.reviewedToday,
    newCardsToday: session.newCardsToday,
    lastReviewDate: session.lastReviewDate,
  };
}

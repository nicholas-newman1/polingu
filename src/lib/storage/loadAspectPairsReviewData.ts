import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { getDefaultAspectPairsReviewStore, ASPECT_PAIRS_SESSION_DOC_PATH } from './helpers';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';
import loadDailyReviewSession from './loadDailyReviewSession';

export default async function loadAspectPairsReviewData(): Promise<AspectPairsReviewDataStore> {
  const { reviewedToday, newCardsToday, lastReviewDate } = getDefaultAspectPairsReviewStore();
  const [cards, session] = await loadDailyReviewSession(
    aspectPairsReviewStorage,
    ASPECT_PAIRS_SESSION_DOC_PATH,
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

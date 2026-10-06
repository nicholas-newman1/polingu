import { getTodayString } from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';
import type { ReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

/**
 * Loads the review cards alongside today's session counters. A session saved on an
 * earlier day is replaced by `freshSession`, which must be empty and dated today.
 */
export default async function loadDailyReviewSession<
  TCard,
  TSession extends { lastReviewDate: string },
>(
  storage: ReviewSubcollectionStorage<TCard>,
  sessionDocPath: string,
  freshSession: TSession
): Promise<[Record<string, TCard>, TSession]> {
  const [cards, session] = await Promise.all([
    storage.loadCards(),
    loadUserData<TSession>(sessionDocPath, freshSession),
  ]);

  return [cards, session.lastReviewDate === getTodayString() ? session : freshSession];
}

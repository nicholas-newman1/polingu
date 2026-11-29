import { getTodayString } from '../storage/helpers';
import type { CardReviewData, ReviewDataStore, SessionId } from '../../types/common';
import { setInSessionList, startDayIfNeeded } from './sessionLists';

export interface ReviewOutcome {
  /** The card was new when rated, so it counts toward today's new-card limit. */
  isNew: boolean;
  /** The card left the session (any rating other than Again). */
  completed: boolean;
  /**
   * The card is back in today's session after an earlier rating was changed to
   * Again, so it no longer counts as reviewed today.
   */
  requeued?: boolean;
}

/** Records a rating in `store`: the card's new review data, and today's lists. */
export function recordCardReview<Store extends ReviewDataStore<CardReviewData, SessionId>>(
  store: Store,
  id: Store['newCardsToday'][number],
  reviewData: Store['cards'][string],
  outcome: ReviewOutcome
): Store {
  let next = startDayIfNeeded(store, getTodayString());
  next = { ...next, cards: { ...next.cards, [id]: reviewData } };
  if (outcome.isNew) next = setInSessionList(next, 'newCardsToday', id, true);
  if (outcome.completed) next = setInSessionList(next, 'reviewedToday', id, true);
  else if (outcome.requeued) next = setInSessionList(next, 'reviewedToday', id, false);
  return next;
}

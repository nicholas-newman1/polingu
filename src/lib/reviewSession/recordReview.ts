import { getTodayString } from '../storage/helpers';
import { setInSessionList, startDayIfNeeded, type SessionChanges } from './sessionLists';

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

interface SessionFields {
  lastReviewDate: string;
  changedAt?: SessionChanges;
}

export function recordCardReview<
  Id extends string | number,
  R,
  Store extends SessionFields & {
    cards: { [key: string]: R };
    reviewedToday: Id[];
    newCardsToday: Id[];
  },
>(store: Store, id: Id, reviewData: R, outcome: ReviewOutcome): Store {
  let next = startDayIfNeeded(store, ['reviewedToday', 'newCardsToday'], getTodayString());
  next = { ...next, cards: { ...next.cards, [id]: reviewData } };
  if (outcome.isNew) next = setInSessionList(next, 'newCardsToday', id, true);
  if (outcome.completed) next = setInSessionList(next, 'reviewedToday', id, true);
  else if (outcome.requeued) next = setInSessionList(next, 'reviewedToday', id, false);
  return next;
}

export function recordFormReview<
  R,
  Store extends SessionFields & {
    forms: { [key: string]: R };
    reviewedToday: string[];
    newFormsToday: string[];
  },
>(store: Store, formKey: string, reviewData: R, outcome: ReviewOutcome): Store {
  let next = startDayIfNeeded(store, ['reviewedToday', 'newFormsToday'], getTodayString());
  next = { ...next, forms: { ...next.forms, [formKey]: reviewData } };
  if (outcome.isNew) next = setInSessionList(next, 'newFormsToday', formKey, true);
  if (outcome.completed) next = setInSessionList(next, 'reviewedToday', formKey, true);
  else if (outcome.requeued) next = setInSessionList(next, 'reviewedToday', formKey, false);
  return next;
}

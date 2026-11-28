import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';

export type TranslationDirection = 'en-to-pl' | 'pl-to-en';

/** When each id was last added to or removed from a day's session list, keyed `${list}:${id}`. */
export type SessionChanges = Record<string, number>;

/** An id in a day's session lists: a card id, word id, verb id or conjugation form key. */
export type SessionId = string | number;

/** What every deck keeps per card; each deck adds the card's own id field. */
export interface CardReviewData {
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

/** A deck's review progress: every card studied, plus today's session lists. */
export interface ReviewDataStore<R extends CardReviewData, Id extends SessionId = string> {
  cards: Record<string, R>;
  reviewedToday: Id[];
  newCardsToday: Id[];
  lastReviewDate: string;
  /** When each id was added to or removed from the lists above; see sessionLists.ts. */
  changedAt?: SessionChanges;
}

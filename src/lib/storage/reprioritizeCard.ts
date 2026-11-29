import { State } from 'ts-fsrs';
import type { CardReviewData, ReviewDataStore, SessionId } from '../../types/common';
import forgetCard from '../fsrsUtils/forgetCard';
import { removeFromDayLists } from '../reviewSession/sessionLists';
import type { DeckPart } from './reviewDeckDocs';

type AnyReviewStore = ReviewDataStore<CardReviewData, SessionId>;

const isStudied = (entry: CardReviewData | undefined) =>
  entry !== undefined && entry.fsrsCard.state !== State.New;

/** Whether the card was studied in any part (direction) of its deck, so it can be reviewed again. */
export function canReprioritize<K extends DeckPart>(
  stores: Record<K, AnyReviewStore>,
  id: SessionId
): boolean {
  return Object.values<AnyReviewStore>(stores).some((store) => isStudied(store.cards[String(id)]));
}

/**
 * "Review again": resets a studied card with `reset` (forgetting it by default) and takes
 * it out of today's lists, so it is offered as a new card again. A card never studied in
 * this store is left as it is.
 */
export function reprioritizeCard<R extends CardReviewData, Id extends SessionId>(
  store: ReviewDataStore<R, Id>,
  id: Id,
  now: Date = new Date(),
  reset: (entry: R) => R = (entry) => forgetCard(entry, now)
): ReviewDataStore<R, Id> {
  const key = String(id);
  const entry = store.cards[key];
  if (!isStudied(entry)) return store;
  const forgotten = { ...store, cards: { ...store.cards, [key]: reset(entry) } };
  return removeFromDayLists(forgotten, id, now.getTime());
}

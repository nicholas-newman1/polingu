/**
 * Builds review sessions for any deck. A deck (see reviewDecks.ts) says how its
 * items map to ids, review data and session cards; the rules for what is due
 * and in which order are the same for all of them:
 *
 * - Reviews: due and learning cards not yet reviewed today, soonest due first.
 * - New cards: unseen cards not yet introduced today, capped by the daily limit.
 *   Cards the learner asked to study next come first (latest request first),
 *   then deck order, or shuffled for decks that shuffle.
 * - Review early: graduated cards not yet due and not reviewed today.
 * - Learner-made cards come before built-in ones in every list.
 * - Filters, where a deck has them, limit new cards and review early; due
 *   reviews always appear.
 */
import type { CardReviewData, ReviewDataStore, SessionId } from '../../types/common';
import getReviewBucket, { type ReviewBucket } from '../fsrsUtils/getReviewBucket';
import isPracticeAheadCandidate from '../fsrsUtils/isPracticeAheadCandidate';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import shuffleArray from '../utils/shuffleArray';
import type { SessionCards } from './sessionQueue';

export interface ReviewDeck<Item, R extends CardReviewData, Id extends SessionId, Card, Filters> {
  /** The id the item's review data and the day's session lists use. */
  idOf(item: Item): Id;
  /** Review data for an item never studied. */
  newReviewData(id: Id): R;
  toSessionCard(item: Item, reviewData: R, isNew: boolean): Card;
  /** Whether the learner made the item. Omitted for decks without learner-made items. */
  isCustom?(item: Item): boolean;
  /** When the learner asked to study the item next, if they did. */
  prioritizedAt?(reviewData: R): number | undefined;
  /** Whether new cards are shuffled rather than introduced in deck order. */
  shuffleNew?: boolean;
  /** Whether the item passes the learner's session filters. Omitted for decks without filters. */
  matches?(item: Item, filters: Filters): boolean;
}

/** The parts of a deck that decide the order of its cards. */
type DeckOrder<Item, R extends CardReviewData> = Pick<
  ReviewDeck<Item, R, SessionId, unknown, unknown>,
  'isCustom' | 'prioritizedAt' | 'shuffleNew'
>;

export interface PlacedItem<Item, R> {
  item: Item;
  reviewData: R;
  /** Where the item belongs in today's session; a new card the filters leave out is null. */
  bucket: ReviewBucket;
  reviewedToday: boolean;
}

/** The item's review data, or fresh data for an item never studied. */
export function reviewDataFor<R extends CardReviewData, Id extends SessionId>(
  deck: Pick<ReviewDeck<unknown, R, Id, unknown, unknown>, 'newReviewData'>,
  store: ReviewDataStore<R, Id>,
  id: Id
): R {
  return store.cards[String(id)] ?? deck.newReviewData(id);
}

const idSet = (ids: SessionId[]) => new Set(ids.map(String));

/** Each item with its review data and where it stands today, in deck order. */
export function placeItems<Item, R extends CardReviewData, Id extends SessionId, Card, Filters>(
  deck: ReviewDeck<Item, R, Id, Card, Filters>,
  items: readonly Item[],
  store: ReviewDataStore<R, Id>,
  filters?: Filters
): PlacedItem<Item, R>[] {
  const introduced = idSet(store.newCardsToday);
  const reviewed = idSet(store.reviewedToday);
  return items.map((item) => {
    const id = deck.idOf(item);
    const reviewData = reviewDataFor(deck, store, id);
    const reviewedToday = reviewed.has(String(id));
    const bucket = getReviewBucket(reviewData.fsrsCard, introduced.has(String(id)), reviewedToday);
    const filteredOut = bucket === 'new' && !passes(deck, item, filters);
    return { item, reviewData, bucket: filteredOut ? null : bucket, reviewedToday };
  });
}

function passes<Item, Filters>(
  deck: Pick<ReviewDeck<Item, CardReviewData, SessionId, unknown, Filters>, 'matches'>,
  item: Item,
  filters: Filters | undefined
): boolean {
  return !deck.matches || filters === undefined || deck.matches(item, filters);
}

/** Learner-made items first, keeping each group's order. */
function customFirst<Item, R extends CardReviewData>(
  deck: DeckOrder<Item, R>,
  placed: PlacedItem<Item, R>[],
  order: (group: PlacedItem<Item, R>[]) => PlacedItem<Item, R>[] = (group) => group
): PlacedItem<Item, R>[] {
  const isCustom = (p: PlacedItem<Item, R>) => deck.isCustom?.(p.item) === true;
  return [...order(placed.filter(isCustom)), ...order(placed.filter((p) => !isCustom(p)))];
}

const byDueDate = <T extends { reviewData: CardReviewData }>(group: T[]) =>
  [...group].sort(sortByDueDate);

function orderNewCards<Item, R extends CardReviewData>(
  deck: DeckOrder<Item, R>,
  placed: PlacedItem<Item, R>[]
): PlacedItem<Item, R>[] {
  const requestedAt = (p: PlacedItem<Item, R>) => deck.prioritizedAt?.(p.reviewData);
  const requested = placed
    .filter((p) => requestedAt(p) !== undefined)
    .sort((a, b) => requestedAt(b)! - requestedAt(a)!);
  const rest = placed.filter((p) => requestedAt(p) === undefined);
  return [...requested, ...customFirst(deck, rest, deck.shuffleNew ? shuffleArray : undefined)];
}

export function getSessionCards<
  Item,
  R extends CardReviewData,
  Id extends SessionId,
  Card,
  Filters,
>(
  deck: ReviewDeck<Item, R, Id, Card, Filters>,
  items: readonly Item[],
  store: ReviewDataStore<R, Id>,
  settings: { newCardsPerDay: number },
  filters?: Filters
): SessionCards<Card> {
  const placed = placeItems(deck, items, store, filters);
  const remainingNew = Math.max(0, settings.newCardsPerDay - store.newCardsToday.length);
  const reviews = customFirst(
    deck,
    placed.filter((p) => p.bucket === 'review'),
    byDueDate
  );
  const newCards = orderNewCards(
    deck,
    placed.filter((p) => p.bucket === 'new')
  ).slice(0, remainingNew);

  return {
    reviewCards: reviews.map((p) => deck.toSessionCard(p.item, p.reviewData, false)),
    newCards: newCards.map((p) => deck.toSessionCard(p.item, p.reviewData, true)),
  };
}

/** "Review early": up to `count` graduated cards that are not due yet, soonest due first. */
export function getPracticeAheadCards<
  Item,
  R extends CardReviewData,
  Id extends SessionId,
  Card,
  Filters,
>(
  deck: ReviewDeck<Item, R, Id, Card, Filters>,
  items: readonly Item[],
  store: ReviewDataStore<R, Id>,
  count: number,
  filters?: Filters
): Card[] {
  const candidates = placeItems(deck, items, store).filter(
    (p) =>
      isPracticeAheadCandidate(p.reviewData.fsrsCard, p.reviewedToday) &&
      passes(deck, p.item, filters)
  );
  return customFirst(deck, candidates, byDueDate)
    .slice(0, count)
    .map((p) => deck.toSessionCard(p.item, p.reviewData, false));
}

/** "Learn extra": up to `count` new cards beyond today's limit. */
export function getExtraNewCards<
  Item,
  R extends CardReviewData,
  Id extends SessionId,
  Card,
  Filters,
>(
  deck: ReviewDeck<Item, R, Id, Card, Filters>,
  items: readonly Item[],
  store: ReviewDataStore<R, Id>,
  count: number,
  filters?: Filters
): Card[] {
  const unseen = placeItems(deck, items, store, filters).filter((p) => p.bucket === 'new');
  return orderNewCards(deck, unseen)
    .slice(0, count)
    .map((p) => deck.toSessionCard(p.item, p.reviewData, true));
}

/** How many cards today's session holds: due reviews plus new cards up to the daily limit. */
export function countDueToday<Item, R extends CardReviewData, Id extends SessionId, Filters>(
  deck: ReviewDeck<Item, R, Id, unknown, Filters>,
  items: readonly Item[],
  store: ReviewDataStore<R, Id>,
  settings: { newCardsPerDay: number },
  filters?: Filters
): number {
  const placed = placeItems(deck, items, store, filters);
  const reviews = placed.filter((p) => p.bucket === 'review').length;
  const unseen = placed.filter((p) => p.bucket === 'new').length;
  const remainingNew = Math.max(0, settings.newCardsPerDay - store.newCardsToday.length);
  return reviews + Math.min(unseen, remainingNew);
}

import type { DeclensionReviewDataStore, DeclensionCardId } from '../../types';
import forgetCard from '../fsrsUtils/forgetCard';
import { removeFromDayLists } from '../reviewSession/sessionLists';

export function canReprioritizeDeclensionCard(
  store: DeclensionReviewDataStore,
  cardId: DeclensionCardId
): boolean {
  const entry = store.cards[cardId];
  return Boolean(entry && entry.fsrsCard.state !== 0);
}

export default function reprioritizeDeclensionCard(
  store: DeclensionReviewDataStore,
  cardId: DeclensionCardId,
  now: Date = new Date()
): DeclensionReviewDataStore {
  const entry = store.cards[cardId];
  if (!entry || entry.fsrsCard.state === 0) {
    return store;
  }
  const forgotten = { ...store, cards: { ...store.cards, [cardId]: forgetCard(entry, now) } };
  return removeFromDayLists(forgotten, cardId, now.getTime());
}

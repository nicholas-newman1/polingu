import type { DeclensionCard, DeclensionFilters, DeclensionReviewDataStore } from '../../types';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import { declensionDeck, matchesDeclensionFilters } from '../reviewSession/reviewDecks';
import buildListeningQueue from './buildListeningQueue';

export interface BuildDeclensionListeningQueueArgs {
  cards: DeclensionCard[];
  reviewStore: DeclensionReviewDataStore;
  ordering: ListeningOrdering;
  filters?: DeclensionFilters;
}

export default function buildDeclensionListeningQueue({
  cards,
  reviewStore,
  ordering,
  filters,
}: BuildDeclensionListeningQueueArgs): ListeningQueueItem[] {
  return buildListeningQueue({
    items: cards,
    deck: declensionDeck,
    reviewStore,
    ordering,
    feature: 'declension',
    idPrefix: 'declension',
    include: (card) => !filters || matchesDeclensionFilters(card, filters),
    text: (card) => ({ primaryText: card.declined, secondaryText: `${card.front} → ${card.back}` }),
  });
}

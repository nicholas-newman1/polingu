import type {
  DeclensionCard,
  DeclensionReviewDataStore,
  Case,
  Gender,
  Number as NounNumber,
} from '../../types';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import isFsrsCardLearned from './isFsrsCardLearned';
import orderListeningPool from './orderListeningPool';

export interface DeclensionListeningFilters {
  cases?: Case[];
  genders?: Gender[];
  number?: NounNumber | 'All';
}

export interface BuildDeclensionListeningQueueArgs {
  cards: DeclensionCard[];
  reviewStore: DeclensionReviewDataStore;
  ordering: ListeningOrdering;
  filters?: DeclensionListeningFilters;
  limit?: number;
}

function matchesFilters(card: DeclensionCard, filters?: DeclensionListeningFilters): boolean {
  if (!filters) return true;
  if (filters.cases && filters.cases.length > 0 && !filters.cases.includes(card.case)) {
    return false;
  }
  if (filters.genders && filters.genders.length > 0 && !filters.genders.includes(card.gender)) {
    return false;
  }
  if (filters.number && filters.number !== 'All' && card.number !== filters.number) {
    return false;
  }
  return true;
}

export default function buildDeclensionListeningQueue({
  cards,
  reviewStore,
  ordering,
  filters,
  limit,
}: BuildDeclensionListeningQueueArgs): ListeningQueueItem[] {
  const filtered = cards.filter((c) => !!c.audioUrl && matchesFilters(c, filters));

  const pool = orderListeningPool(
    filtered.map((card) => ({
      item: card,
      reviewData: getOrCreateDeclensionCardReviewData(card.id, reviewStore),
    })),
    ordering,
    limit
  );

  return pool.map(({ item: card, reviewData }) => ({
    id: `declension:${card.id}`,
    feature: 'declension',
    audioUrl: card.audioUrl!,
    primaryText: card.declined,
    secondaryText: `${card.front} → ${card.back}`,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}

import type {
  DeclensionCard,
  DeclensionReviewDataStore,
  Case,
  Gender,
  Number as NounNumber,
} from '../../types';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import getOrCreateDeclensionCardReviewData from '../storage/getOrCreateDeclensionCardReviewData';
import isDue from '../fsrsUtils/isDue';
import shuffleArray from '../utils/shuffleArray';
import isFsrsCardLearned from './isFsrsCardLearned';

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

  const withMeta = filtered.map((card) => {
    const reviewData = getOrCreateDeclensionCardReviewData(card.id, reviewStore);
    return { card, reviewData };
  });

  let pool: typeof withMeta;
  switch (ordering) {
    case 'due':
      pool = withMeta.filter(
        (c) => c.reviewData.fsrsCard.state !== 0 && isDue(c.reviewData.fsrsCard)
      );
      pool.sort(
        (a, b) =>
          new Date(a.reviewData.fsrsCard.due).getTime() -
          new Date(b.reviewData.fsrsCard.due).getTime()
      );
      break;
    case 'practice-ahead':
      pool = withMeta.filter(
        (c) => c.reviewData.fsrsCard.state !== 0 && !isDue(c.reviewData.fsrsCard)
      );
      pool.sort(
        (a, b) =>
          new Date(a.reviewData.fsrsCard.due).getTime() -
          new Date(b.reviewData.fsrsCard.due).getTime()
      );
      break;
    case 'learned':
      pool = withMeta.filter((c) => isFsrsCardLearned(c.reviewData.fsrsCard));
      pool = shuffleArray(pool);
      break;
    case 'recently-added': {
      const custom = withMeta.filter((c) => c.card.isCustom);
      const system = withMeta.filter((c) => !c.card.isCustom);
      custom.sort((a, b) => {
        const aCreated = ((a.card as { createdAt?: number }).createdAt as number | undefined) ?? 0;
        const bCreated = ((b.card as { createdAt?: number }).createdAt as number | undefined) ?? 0;
        return bCreated - aCreated;
      });
      system.reverse();
      pool = [...custom, ...system];
      break;
    }
    case 'random':
    default:
      pool = shuffleArray(withMeta);
      break;
  }

  const sliced = typeof limit === 'number' ? pool.slice(0, limit) : pool;

  return sliced.map(({ card, reviewData }) => ({
    id: `declension:${card.id}`,
    feature: 'declension',
    audioUrl: card.audioUrl!,
    primaryText: card.declined,
    secondaryText: `${card.front} → ${card.back}`,
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}

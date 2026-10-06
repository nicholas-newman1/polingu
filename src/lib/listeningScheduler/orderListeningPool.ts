import type { Card as FSRSCard } from 'ts-fsrs';
import type { ListeningOrdering } from '../../types/listening';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import shuffleArray from '../utils/shuffleArray';
import isFsrsCardLearned from './isFsrsCardLearned';

interface PoolEntry<T> {
  item: T;
  reviewData: { fsrsCard: FSRSCard };
}

const getCreatedAt = (item: object): number =>
  ((item as { createdAt?: number }).createdAt as number | undefined) ?? 0;

function recentlyAddedFirst<T extends { isCustom?: boolean }>(
  entries: PoolEntry<T>[]
): PoolEntry<T>[] {
  const custom = entries
    .filter((entry) => entry.item.isCustom)
    .sort((a, b) => getCreatedAt(b.item) - getCreatedAt(a.item));
  const system = entries.filter((entry) => !entry.item.isCustom).reverse();
  return [...custom, ...system];
}

function orderEntries<T extends { isCustom?: boolean }>(
  entries: PoolEntry<T>[],
  ordering: ListeningOrdering
): PoolEntry<T>[] {
  const isStarted = (entry: PoolEntry<T>) => entry.reviewData.fsrsCard.state !== 0;

  switch (ordering) {
    case 'due':
      return entries
        .filter((entry) => isStarted(entry) && isDue(entry.reviewData.fsrsCard))
        .sort(sortByDueDate);
    case 'practice-ahead':
      return entries
        .filter((entry) => isStarted(entry) && !isDue(entry.reviewData.fsrsCard))
        .sort(sortByDueDate);
    case 'learned':
      return shuffleArray(entries.filter((entry) => isFsrsCardLearned(entry.reviewData.fsrsCard)));
    case 'recently-added':
      return recentlyAddedFirst(entries);
    case 'random':
    default:
      return shuffleArray(entries);
  }
}

export default function orderListeningPool<T extends { isCustom?: boolean }>(
  entries: PoolEntry<T>[],
  ordering: ListeningOrdering,
  limit?: number
): PoolEntry<T>[] {
  const pool = orderEntries(entries, ordering);
  return typeof limit === 'number' ? pool.slice(0, limit) : pool;
}

import {
  fsrs,
  Rating,
  type Card as FSRSCard,
  type RecordLogItem,
  type Grade,
} from 'ts-fsrs';

export const f = fsrs();

export { Rating };
export type { Grade };

export function isDue(fsrsCard: FSRSCard): boolean {
  if (fsrsCard.state === 0) return false;
  return new Date(fsrsCard.due) <= new Date();
}

export function formatInterval(card: FSRSCard, now: Date = new Date()): string {
  const due = new Date(card.due);
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return '<1m';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export function getNextIntervals(
  fsrsCard: FSRSCard,
  now: Date = new Date()
): Record<Grade, string> {
  const result = f.repeat(fsrsCard, now);

  return {
    [Rating.Again]: formatInterval(result[Rating.Again].card, now),
    [Rating.Hard]: formatInterval(result[Rating.Hard].card, now),
    [Rating.Good]: formatInterval(result[Rating.Good].card, now),
    [Rating.Easy]: formatInterval(result[Rating.Easy].card, now),
  };
}

export function sortByDueDate<T extends { reviewData: { fsrsCard: FSRSCard } }>(
  a: T,
  b: T
): number {
  const dateA = new Date(a.reviewData.fsrsCard.due).getTime();
  const dateB = new Date(b.reviewData.fsrsCard.due).getTime();
  return dateA - dateB;
}

export function rateCard<T extends { fsrsCard: FSRSCard }>(
  reviewData: T,
  rating: Grade,
  now: Date = new Date()
): T {
  const result = f.repeat(reviewData.fsrsCard, now);
  const item: RecordLogItem = result[rating];
  return {
    ...reviewData,
    fsrsCard: item.card,
    log: item.log,
  };
}


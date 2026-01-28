import type { Card as FSRSCard } from 'ts-fsrs';

export default function sortByDueDate<T extends { reviewData: { fsrsCard: FSRSCard } }>(
  a: T,
  b: T
): number {
  const dateA = new Date(a.reviewData.fsrsCard.due).getTime();
  const dateB = new Date(b.reviewData.fsrsCard.due).getTime();
  return dateA - dateB;
}

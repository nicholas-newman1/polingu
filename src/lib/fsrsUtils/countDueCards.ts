import type { ReviewBucket } from './getReviewBucket';

/** Due reviews plus new cards, with new cards capped at the remaining daily allowance. */
export default function countDueCards(buckets: ReviewBucket[], remainingNewToday: number): number {
  const reviews = buckets.filter((bucket) => bucket === 'review').length;
  const newCards = buckets.filter((bucket) => bucket === 'new').length;
  return reviews + Math.min(newCards, Math.max(0, remainingNewToday));
}

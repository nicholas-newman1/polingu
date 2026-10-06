import type { Card as FSRSCard } from 'ts-fsrs';
import isDue from './isDue';

export type ReviewBucket = 'new' | 'review' | null;

/**
 * Where a card belongs in today's session: unseen cards are `new` unless already introduced
 * today; learning/relearning and due cards are `review` unless already reviewed today.
 */
export default function getReviewBucket(
  fsrsCard: FSRSCard,
  introducedToday: boolean,
  reviewedToday: boolean
): ReviewBucket {
  const { state } = fsrsCard;
  if (state === 0) return introducedToday ? null : 'new';
  const isLearning = state === 1 || state === 3;
  if (isLearning || isDue(fsrsCard)) return reviewedToday ? null : 'review';
  return null;
}

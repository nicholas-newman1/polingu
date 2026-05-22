import type { Card as FSRSCard } from 'ts-fsrs';
import f from './fsrsInstance';

export default function forgetCard<T extends { fsrsCard: FSRSCard }>(
  reviewData: T,
  now: Date = new Date()
): T {
  const { card, log } = f.forget(reviewData.fsrsCard, now);
  return {
    ...reviewData,
    fsrsCard: card,
    log,
  };
}

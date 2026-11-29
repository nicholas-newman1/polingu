import type { Card as FSRSCard } from 'ts-fsrs';
import f from './fsrsInstance';

export default function forgetCard<T extends { fsrsCard: FSRSCard }>(
  reviewData: T,
  now: Date = new Date()
): T {
  return { ...reviewData, fsrsCard: f.forget(reviewData.fsrsCard, now).card };
}

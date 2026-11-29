import type { Card as FSRSCard, Grade } from 'ts-fsrs';
import f from './fsrsInstance';

export default function rateCard<T extends { fsrsCard: FSRSCard }>(
  reviewData: T,
  rating: Grade,
  now: Date = new Date()
): T {
  return { ...reviewData, fsrsCard: f.repeat(reviewData.fsrsCard, now)[rating].card };
}

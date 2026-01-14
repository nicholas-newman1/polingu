import type { Card as FSRSCard, RecordLogItem, Grade } from 'ts-fsrs';
import f from './fsrsInstance';

export default function rateCard<T extends { fsrsCard: FSRSCard }>(
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


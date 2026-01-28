import type { SentenceCardReviewData } from '../../types/sentences';
import rateCard from '../fsrsUtils/rateCard';
import type { Grade } from 'ts-fsrs';

export default function rateSentenceCard(
  reviewData: SentenceCardReviewData,
  rating: Grade,
  now?: Date
): SentenceCardReviewData {
  return rateCard(reviewData, rating, now);
}

import type { VocabularyCardReviewData } from '../../types/vocabulary';
import rateCard from '../fsrsUtils/rateCard';
import type { Grade } from 'ts-fsrs';

export default function rateVocabularyCard(
  reviewData: VocabularyCardReviewData,
  rating: Grade,
  now?: Date
): VocabularyCardReviewData {
  return rateCard(reviewData, rating, now);
}


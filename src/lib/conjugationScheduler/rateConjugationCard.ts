import { type Grade } from 'ts-fsrs';
import type { ConjugationFormReviewData } from '../../types/conjugation';
import rateCard from '../fsrsUtils/rateCard';

export default function rateConjugationCard(
  reviewData: ConjugationFormReviewData,
  rating: Grade
): ConjugationFormReviewData {
  return rateCard(reviewData, rating);
}

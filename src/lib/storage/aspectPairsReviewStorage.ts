import type { AspectPairsCardReviewData } from '../../types/aspectPairs';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

export const aspectPairsReviewStorage =
  createReviewSubcollectionStorage<AspectPairsCardReviewData>('aspectPairsReviewCards');

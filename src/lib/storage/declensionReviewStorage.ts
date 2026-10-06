import type { DeclensionCardReviewData } from '../../types';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

export const declensionReviewStorage =
  createReviewSubcollectionStorage<DeclensionCardReviewData>('declensionReviewCards');

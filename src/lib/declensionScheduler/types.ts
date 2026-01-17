import type { DeclensionCard, DeclensionCardReviewData, Case, Gender, Number } from '../../types';

export interface DeclensionFilters {
  case: Case | 'All';
  gender: Gender | 'All';
  number: Number | 'All';
}

export interface DeclensionSessionCard {
  card: DeclensionCard;
  reviewData: DeclensionCardReviewData;
  isNew: boolean;
}


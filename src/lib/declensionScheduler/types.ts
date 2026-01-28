import type { DeclensionCard, DeclensionCardReviewData, Case, Gender, Number } from '../../types';

export interface DeclensionFilters {
  cases: Case[];
  genders: Gender[];
  number: Number | 'All';
}

export interface DeclensionSessionCard {
  card: DeclensionCard;
  reviewData: DeclensionCardReviewData;
  isNew: boolean;
}

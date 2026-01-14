import type { Card, CardReviewData, Case, Gender, Number } from '../../types';

export interface Filters {
  case: Case | 'All';
  gender: Gender | 'All';
  number: Number | 'All';
}

export interface SessionCard {
  card: Card;
  reviewData: CardReviewData;
  isNew: boolean;
}


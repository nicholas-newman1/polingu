import type { CardReviewData, ReviewDataStore } from './common';
import type { Verb } from './conjugation';

export interface AspectPairCard {
  verb: Verb;
  pairVerb: Verb;
}

export interface AspectPairsCardReviewData extends CardReviewData {
  verbId: string;
}

export type AspectPairsReviewDataStore = ReviewDataStore<AspectPairsCardReviewData>;

export interface AspectPairsSessionCard {
  card: AspectPairCard;
  reviewData: AspectPairsCardReviewData;
  isNew: boolean;
}

export interface AspectPairsSettings {
  newCardsPerDay: number;
}

export const DEFAULT_ASPECT_PAIRS_SETTINGS: AspectPairsSettings = {
  newCardsPerDay: 5,
};

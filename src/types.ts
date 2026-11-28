import type { CardReviewData, ReviewDataStore } from './types/common';
import type { CustomItemBase } from './types/customItems';
import type { CardAudioFields } from './types/audio';

export type Case =
  | 'Nominative'
  | 'Genitive'
  | 'Dative'
  | 'Accusative'
  | 'Instrumental'
  | 'Locative'
  | 'Vocative';

export type Gender = 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';

export type Number = 'Singular' | 'Plural';

export type DeclensionCardId = number | string;

export interface DeclensionCard extends CardAudioFields {
  id: DeclensionCardId;
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  /** Whole-sentence English translation of `back`. Required on built-in cards. */
  english?: string;
  hint?: string;
  isCustom?: boolean;
  translations?: Record<string, string>;
  audioUrl?: string;
}

export interface CustomDeclensionCard extends CustomItemBase {
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  english?: string;
  hint?: string;
  translations?: Record<string, string>;
  audioUrl?: string;
}

export interface DeclensionCardReviewData extends CardReviewData {
  cardId: DeclensionCardId;
}

export interface DeclensionSettings {
  newCardsPerDay: number;
}

export type DeclensionReviewDataStore = ReviewDataStore<DeclensionCardReviewData, DeclensionCardId>;

/** Limits the new cards a declension session serves; an empty list means any. */
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

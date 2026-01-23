import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';
import type { CustomItemBase } from './types/customItems';

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

export interface DeclensionCard {
  id: DeclensionCardId;
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  hint?: string;
  isCustom?: boolean;
  translations?: Record<string, string>;
}

export interface CustomDeclensionCard extends CustomItemBase {
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  hint?: string;
  translations?: Record<string, string>;
}

export interface DeclensionCardReviewData {
  cardId: DeclensionCardId;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface DeclensionSettings {
  newCardsPerDay: number;
}

export interface DeclensionReviewDataStore {
  cards: Record<DeclensionCardId, DeclensionCardReviewData>;
  reviewedToday: DeclensionCardId[];
  newCardsToday: DeclensionCardId[];
  lastReviewDate: string;
}

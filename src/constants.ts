import type { Case, Gender, Number, DeclensionSettings } from './types';

export const CASES: Case[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];

export const GENDERS: Gender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];

export const NUMBERS: Number[] = ['Singular', 'Plural'];

export const DEFAULT_DECLENSION_SETTINGS: DeclensionSettings = { newCardsPerDay: 10 };

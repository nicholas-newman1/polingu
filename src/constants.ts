import type { Case, Gender, Number, Settings } from './types';

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

export const DEFAULT_SETTINGS: Settings = { newCardsPerDay: 10 };

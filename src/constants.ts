import type { Case, Gender, Number, DeclensionSettings } from './types';

// Site branding - change these values to rename the site
export const SITE_NAME = 'Polingu';
export const SITE_TAGLINE = 'Master Polish with spaced repetition';

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

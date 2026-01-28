import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';
import type { TranslationDirection } from '../components/DirectionToggle';

export type Aspect = 'Imperfective' | 'Perfective';

export type VerbClass = '-ać' | '-ić' | '-yć' | '-eć' | '-ować' | 'Irregular';

export type Tense = 'present' | 'past' | 'future' | 'imperative' | 'conditional';

export type Person = '1st' | '2nd' | '3rd';

export type GrammaticalNumber = 'Singular' | 'Plural';

export type ConjugationGender = 'Masculine' | 'Feminine' | 'Neuter';

export type PresentFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';

export type PastFormKey =
  | '1sg_m'
  | '1sg_f'
  | '2sg_m'
  | '2sg_f'
  | '3sg_m'
  | '3sg_f'
  | '3sg_n'
  | '1pl_m'
  | '1pl_f'
  | '2pl_m'
  | '2pl_f'
  | '3pl_m'
  | '3pl_f';

export type FutureFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';

export type ImperativeFormKey = '2sg' | '1pl' | '2pl';

export type ConditionalFormKey =
  | '1sg_m'
  | '1sg_f'
  | '2sg_m'
  | '2sg_f'
  | '3sg_m'
  | '3sg_f'
  | '3sg_n'
  | '1pl_m'
  | '1pl_f'
  | '2pl_m'
  | '2pl_f'
  | '3pl_m'
  | '3pl_f';

export interface ConjugationForm {
  pl: string;
  plAlternatives?: string[];
  en: string[];
}

export interface Verb {
  id: string;
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  aspectPair?: string;
  verbClass: VerbClass;
  isIrregular: boolean;
  isReflexive: boolean;
  conjugations: {
    present: Record<PresentFormKey, ConjugationForm>;
    past: Record<PastFormKey, ConjugationForm>;
    future: Record<FutureFormKey, ConjugationForm>;
    imperative: Record<ImperativeFormKey, ConjugationForm>;
    conditional: Record<ConditionalFormKey, ConjugationForm>;
  };
}

export type ConjugationFormKey = string;

export interface ConjugationFormReviewData {
  formKey: ConjugationFormKey;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface ConjugationReviewDataStore {
  forms: Record<ConjugationFormKey, ConjugationFormReviewData>;
  reviewedToday: ConjugationFormKey[];
  newFormsToday: ConjugationFormKey[];
  lastReviewDate: string;
}

export interface ConjugationDirectionSettings {
  newCardsPerDay: number;
}

export type ConjugationDirection = TranslationDirection;

export type ConjugationSettings = Record<ConjugationDirection, ConjugationDirectionSettings>;

export interface ConjugationFilters {
  tenses: Tense[];
  persons: Person[];
  number: GrammaticalNumber | 'All';
  aspects: Aspect[];
  verbClasses: VerbClass[];
  genders: ConjugationGender[];
}

export interface DrillableForm {
  verb: Verb;
  tense: Tense;
  formKey: string;
  form: ConjugationForm;
  person: Person;
  number: GrammaticalNumber;
  gender?: ConjugationGender;
  fullFormKey: ConjugationFormKey;
}

export const ALL_TENSES: Tense[] = ['present', 'past', 'future', 'imperative', 'conditional'];
export const ALL_PERSONS: Person[] = ['1st', '2nd', '3rd'];
export const ALL_ASPECTS: Aspect[] = ['Imperfective', 'Perfective'];
export const ALL_VERB_CLASSES: VerbClass[] = ['-ać', '-ić', '-yć', '-eć', '-ować', 'Irregular'];
export const ALL_CONJUGATION_GENDERS: ConjugationGender[] = ['Masculine', 'Feminine', 'Neuter'];

export const PRESENT_FORM_KEYS: PresentFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
export const PAST_FORM_KEYS: PastFormKey[] = [
  '1sg_m',
  '1sg_f',
  '2sg_m',
  '2sg_f',
  '3sg_m',
  '3sg_f',
  '3sg_n',
  '1pl_m',
  '1pl_f',
  '2pl_m',
  '2pl_f',
  '3pl_m',
  '3pl_f',
];
export const FUTURE_FORM_KEYS: FutureFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
export const IMPERATIVE_FORM_KEYS: ImperativeFormKey[] = ['2sg', '1pl', '2pl'];
export const CONDITIONAL_FORM_KEYS: ConditionalFormKey[] = [
  '1sg_m',
  '1sg_f',
  '2sg_m',
  '2sg_f',
  '3sg_m',
  '3sg_f',
  '3sg_n',
  '1pl_m',
  '1pl_f',
  '2pl_m',
  '2pl_f',
  '3pl_m',
  '3pl_f',
];

export const TENSE_LABELS: Record<Tense, string> = {
  present: 'Present',
  past: 'Past',
  future: 'Future',
  imperative: 'Imperative',
  conditional: 'Conditional',
};

export const DEFAULT_CONJUGATION_SETTINGS: ConjugationSettings = {
  'pl-to-en': { newCardsPerDay: 10 },
  'en-to-pl': { newCardsPerDay: 10 },
};

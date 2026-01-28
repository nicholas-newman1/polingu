export type Aspect = 'Imperfective' | 'Perfective';
export type VerbClass = '-ać' | '-ić' | '-yć' | '-eć' | '-ować' | 'Irregular';
export type Tense = 'present' | 'past' | 'future' | 'imperative' | 'conditional';

export type PresentFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';
export type PastFormKey =
  | '1sg_m' | '1sg_f'
  | '2sg_m' | '2sg_f'
  | '3sg_m' | '3sg_f' | '3sg_n'
  | '1pl_m' | '1pl_f'
  | '2pl_m' | '2pl_f'
  | '3pl_m' | '3pl_f';
export type FutureFormKey = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl';
export type ImperativeFormKey = '2sg' | '1pl' | '2pl';
export type ConditionalFormKey =
  | '1sg_m' | '1sg_f'
  | '2sg_m' | '2sg_f'
  | '3sg_m' | '3sg_f' | '3sg_n'
  | '1pl_m' | '1pl_f'
  | '2pl_m' | '2pl_f'
  | '3pl_m' | '3pl_f';

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

export interface VerbIndex {
  id: string;
  infinitive: string;
  aspect: Aspect;
  verbClass: VerbClass;
}

export const VALID_ASPECTS: Aspect[] = ['Imperfective', 'Perfective'];
export const VALID_VERB_CLASSES: VerbClass[] = ['-ać', '-ić', '-yć', '-eć', '-ować', 'Irregular'];
export const VALID_TENSES: Tense[] = ['present', 'past', 'future', 'imperative', 'conditional'];

export const PRESENT_FORM_KEYS: PresentFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
export const PAST_FORM_KEYS: PastFormKey[] = [
  '1sg_m', '1sg_f',
  '2sg_m', '2sg_f',
  '3sg_m', '3sg_f', '3sg_n',
  '1pl_m', '1pl_f',
  '2pl_m', '2pl_f',
  '3pl_m', '3pl_f',
];
export const FUTURE_FORM_KEYS: FutureFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
export const IMPERATIVE_FORM_KEYS: ImperativeFormKey[] = ['2sg', '1pl', '2pl'];
export const CONDITIONAL_FORM_KEYS: ConditionalFormKey[] = [
  '1sg_m', '1sg_f',
  '2sg_m', '2sg_f',
  '3sg_m', '3sg_f', '3sg_n',
  '1pl_m', '1pl_f',
  '2pl_m', '2pl_f',
  '3pl_m', '3pl_f',
];

export function isValidAspect(value: string): value is Aspect {
  return VALID_ASPECTS.includes(value as Aspect);
}

export function isValidVerbClass(value: string): value is VerbClass {
  return VALID_VERB_CLASSES.includes(value as VerbClass);
}

function validateConjugationForm(
  form: unknown,
  formKey: string,
  tense: string,
  verbId: string,
  requireAlternatives: boolean = false
): string[] {
  const errors: string[] = [];
  const f = form as Record<string, unknown>;

  if (!f || typeof f !== 'object') {
    errors.push(`${verbId}.conjugations.${tense}.${formKey}: missing or not an object`);
    return errors;
  }

  if (typeof f.pl !== 'string' || !f.pl) {
    errors.push(`${verbId}.conjugations.${tense}.${formKey}.pl: missing or invalid`);
  }

  if (!Array.isArray(f.en) || f.en.length === 0) {
    errors.push(`${verbId}.conjugations.${tense}.${formKey}.en: must be non-empty array`);
  } else if (!f.en.every((e: unknown) => typeof e === 'string')) {
    errors.push(`${verbId}.conjugations.${tense}.${formKey}.en: all items must be strings`);
  }

  if (requireAlternatives) {
    if (!f.plAlternatives || !Array.isArray(f.plAlternatives) || f.plAlternatives.length === 0) {
      errors.push(`${verbId}.conjugations.${tense}.${formKey}.plAlternatives: required for imperfective future`);
    }
  }

  if (f.plAlternatives !== undefined) {
    if (!Array.isArray(f.plAlternatives)) {
      errors.push(`${verbId}.conjugations.${tense}.${formKey}.plAlternatives: must be an array`);
    } else if (!f.plAlternatives.every((a: unknown) => typeof a === 'string')) {
      errors.push(`${verbId}.conjugations.${tense}.${formKey}.plAlternatives: all items must be strings`);
    }
  }

  return errors;
}

export function validateVerb(verb: unknown, allVerbs: Map<string, unknown>): string[] {
  const errors: string[] = [];
  const v = verb as Record<string, unknown>;

  if (typeof v.id !== 'string' || !v.id) {
    errors.push('missing or invalid "id"');
    return errors;
  }

  const verbId = v.id;

  if (typeof v.infinitive !== 'string' || !v.infinitive) {
    errors.push(`${verbId}: missing or invalid "infinitive"`);
  }

  if (typeof v.infinitiveEn !== 'string' || !v.infinitiveEn) {
    errors.push(`${verbId}: missing or invalid "infinitiveEn"`);
  }

  if (!v.aspect || !isValidAspect(v.aspect as string)) {
    errors.push(`${verbId}: invalid "aspect" (must be one of: ${VALID_ASPECTS.join(', ')})`);
  }

  if (!v.verbClass || !isValidVerbClass(v.verbClass as string)) {
    errors.push(`${verbId}: invalid "verbClass" (must be one of: ${VALID_VERB_CLASSES.join(', ')})`);
  }

  if (typeof v.isIrregular !== 'boolean') {
    errors.push(`${verbId}: "isIrregular" must be boolean`);
  }

  if (typeof v.isReflexive !== 'boolean') {
    errors.push(`${verbId}: "isReflexive" must be boolean`);
  }

  if (v.aspectPair !== undefined) {
    if (typeof v.aspectPair !== 'string') {
      errors.push(`${verbId}: "aspectPair" must be a string`);
    } else {
      const pairVerb = allVerbs.get(v.aspectPair);
      if (!pairVerb) {
        errors.push(`${verbId}: aspectPair "${v.aspectPair}" not found in import file`);
      } else {
        const pv = pairVerb as Record<string, unknown>;
        if (pv.aspectPair !== verbId) {
          errors.push(`${verbId}: aspectPair cross-reference mismatch - "${v.aspectPair}" does not point back`);
        }
      }
    }
  }

  if (!v.conjugations || typeof v.conjugations !== 'object') {
    errors.push(`${verbId}: missing "conjugations" object`);
    return errors;
  }

  const conj = v.conjugations as Record<string, unknown>;

  if (v.aspect === 'Imperfective') {
    if (!conj.present || typeof conj.present !== 'object') {
      errors.push(`${verbId}: imperfective verb must have "present" conjugations`);
    } else {
      for (const key of PRESENT_FORM_KEYS) {
        const present = conj.present as Record<string, unknown>;
        errors.push(...validateConjugationForm(present[key], key, 'present', verbId));
      }
    }
  }

  if (!conj.past || typeof conj.past !== 'object') {
    errors.push(`${verbId}: missing "past" conjugations`);
  } else {
    for (const key of PAST_FORM_KEYS) {
      const past = conj.past as Record<string, unknown>;
      errors.push(...validateConjugationForm(past[key], key, 'past', verbId));
    }
  }

  if (!conj.future || typeof conj.future !== 'object') {
    errors.push(`${verbId}: missing "future" conjugations`);
  } else {
    const isImperfective = v.aspect === 'Imperfective';
    for (const key of FUTURE_FORM_KEYS) {
      const future = conj.future as Record<string, unknown>;
      errors.push(...validateConjugationForm(future[key], key, 'future', verbId, isImperfective));
    }
  }

  if (!conj.imperative || typeof conj.imperative !== 'object') {
    errors.push(`${verbId}: missing "imperative" conjugations`);
  } else {
    for (const key of IMPERATIVE_FORM_KEYS) {
      const imperative = conj.imperative as Record<string, unknown>;
      errors.push(...validateConjugationForm(imperative[key], key, 'imperative', verbId));
    }
  }

  if (!conj.conditional || typeof conj.conditional !== 'object') {
    errors.push(`${verbId}: missing "conditional" conjugations`);
  } else {
    for (const key of CONDITIONAL_FORM_KEYS) {
      const conditional = conj.conditional as Record<string, unknown>;
      errors.push(...validateConjugationForm(conditional[key], key, 'conditional', verbId));
    }
  }

  return errors;
}


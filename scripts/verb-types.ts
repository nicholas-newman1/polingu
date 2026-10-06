import type {
  Aspect,
  ConditionalFormKey,
  ConjugationForm,
  FutureFormKey,
  ImperativeFormKey,
  PastFormKey,
  PresentFormKey,
  Tense,
  VerbClass,
} from '../src/types/conjugation.js';

export type { Aspect, Tense, VerbClass };

export interface ImportedVerb {
  id: string;
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  aspectPair?: string;
  verbClass: VerbClass;
  isIrregular: boolean;
  isReflexive: boolean;
  isDefective?: boolean;
  isImpersonal?: boolean;
  conjugations: {
    present?: Record<PresentFormKey, ConjugationForm>;
    past: Record<PastFormKey, ConjugationForm>;
    future: Record<FutureFormKey, ConjugationForm>;
    imperative?: Record<ImperativeFormKey, ConjugationForm>;
    conditional: Record<ConditionalFormKey, ConjugationForm>;
  };
}

export interface VerbIndex {
  id: string;
  infinitive: string;
  aspect: Aspect;
  verbClass: VerbClass;
}

const VALID_ASPECTS: Aspect[] = ['Imperfective', 'Perfective'];
const VALID_VERB_CLASSES: VerbClass[] = ['-ać', '-ić', '-yć', '-eć', '-ować', 'Irregular'];
const VALID_TENSES: Tense[] = ['present', 'past', 'future', 'imperative', 'conditional'];

const PRESENT_FORM_KEYS: PresentFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
const PAST_FORM_KEYS: PastFormKey[] = [
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
const FUTURE_FORM_KEYS: FutureFormKey[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
const IMPERATIVE_FORM_KEYS: ImperativeFormKey[] = ['2sg', '1pl', '2pl'];
const CONDITIONAL_FORM_KEYS: ConditionalFormKey[] = [
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

const IMPERSONAL_PRESENT_FORM_KEYS: PresentFormKey[] = ['3sg', '3pl'];
const IMPERSONAL_PAST_FORM_KEYS: PastFormKey[] = ['3sg_m', '3sg_f', '3sg_n', '3pl_m', '3pl_f'];
const IMPERSONAL_FUTURE_FORM_KEYS: FutureFormKey[] = ['3sg', '3pl'];
const IMPERSONAL_CONDITIONAL_FORM_KEYS: ConditionalFormKey[] = [
  '3sg_m',
  '3sg_f',
  '3sg_n',
  '3pl_m',
  '3pl_f',
];

function isValidAspect(value: string): value is Aspect {
  return VALID_ASPECTS.includes(value as Aspect);
}

function isValidVerbClass(value: string): value is VerbClass {
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
      errors.push(
        `${verbId}.conjugations.${tense}.${formKey}.plAlternatives: required for imperfective future`
      );
    }
  }

  if (f.plAlternatives !== undefined) {
    if (!Array.isArray(f.plAlternatives)) {
      errors.push(`${verbId}.conjugations.${tense}.${formKey}.plAlternatives: must be an array`);
    } else if (!f.plAlternatives.every((a: unknown) => typeof a === 'string')) {
      errors.push(
        `${verbId}.conjugations.${tense}.${formKey}.plAlternatives: all items must be strings`
      );
    }
  }

  return errors;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

const VERB_FIELD_RULES: [check: (v: Record<string, unknown>) => boolean, message: string][] = [
  [(v) => isNonEmptyString(v.infinitive), 'missing or invalid "infinitive"'],
  [(v) => isNonEmptyString(v.infinitiveEn), 'missing or invalid "infinitiveEn"'],
  [
    (v) => !!v.aspect && isValidAspect(v.aspect as string),
    `invalid "aspect" (must be one of: ${VALID_ASPECTS.join(', ')})`,
  ],
  [
    (v) => !!v.verbClass && isValidVerbClass(v.verbClass as string),
    `invalid "verbClass" (must be one of: ${VALID_VERB_CLASSES.join(', ')})`,
  ],
  [(v) => typeof v.isIrregular === 'boolean', '"isIrregular" must be boolean'],
  [(v) => typeof v.isReflexive === 'boolean', '"isReflexive" must be boolean'],
  [(v) => isOptionalBoolean(v.isDefective), '"isDefective" must be boolean'],
  [(v) => isOptionalBoolean(v.isImpersonal), '"isImpersonal" must be boolean'],
];

function validateAspectPair(
  v: Record<string, unknown>,
  verbId: string,
  allVerbs: Map<string, unknown>
): string[] {
  if (v.aspectPair === undefined) return [];
  if (typeof v.aspectPair !== 'string') return [`${verbId}: "aspectPair" must be a string`];

  const pairVerb = allVerbs.get(v.aspectPair) as Record<string, unknown> | undefined;
  if (!pairVerb) return [`${verbId}: aspectPair "${v.aspectPair}" not found in import file`];
  if (pairVerb.aspectPair !== verbId) {
    return [
      `${verbId}: aspectPair cross-reference mismatch - "${v.aspectPair}" does not point back`,
    ];
  }
  return [];
}

function validateTense(
  conj: Record<string, unknown>,
  tense: string,
  keys: readonly string[],
  verbId: string,
  missingMessage: string,
  requireAlternatives = false
): string[] {
  const forms = conj[tense];
  if (!forms || typeof forms !== 'object') return [`${verbId}: ${missingMessage}`];
  const record = forms as Record<string, unknown>;
  return keys.flatMap((key) =>
    validateConjugationForm(record[key], key, tense, verbId, requireAlternatives)
  );
}

function validateConjugations(v: Record<string, unknown>, verbId: string): string[] {
  if (!v.conjugations || typeof v.conjugations !== 'object') {
    return [`${verbId}: missing "conjugations" object`];
  }

  const conj = v.conjugations as Record<string, unknown>;
  const isImpersonal = v.isImpersonal === true;
  const isImperfective = v.aspect === 'Imperfective';
  const errors: string[] = [];

  if (isImperfective) {
    const presentKeys = isImpersonal ? IMPERSONAL_PRESENT_FORM_KEYS : PRESENT_FORM_KEYS;
    errors.push(
      ...validateTense(
        conj,
        'present',
        presentKeys,
        verbId,
        'imperfective verb must have "present" conjugations'
      )
    );
  }

  const pastKeys = isImpersonal ? IMPERSONAL_PAST_FORM_KEYS : PAST_FORM_KEYS;
  errors.push(...validateTense(conj, 'past', pastKeys, verbId, 'missing "past" conjugations'));

  const futureKeys = isImpersonal ? IMPERSONAL_FUTURE_FORM_KEYS : FUTURE_FORM_KEYS;
  errors.push(
    ...validateTense(
      conj,
      'future',
      futureKeys,
      verbId,
      'missing "future" conjugations',
      isImperfective
    )
  );

  if (v.isDefective || isImpersonal) {
    if (conj.imperative) {
      errors.push(`${verbId}: defective/impersonal verb should not have "imperative" conjugations`);
    }
  } else {
    errors.push(
      ...validateTense(
        conj,
        'imperative',
        IMPERATIVE_FORM_KEYS,
        verbId,
        'missing "imperative" conjugations'
      )
    );
  }

  const conditionalKeys = isImpersonal ? IMPERSONAL_CONDITIONAL_FORM_KEYS : CONDITIONAL_FORM_KEYS;
  errors.push(
    ...validateTense(
      conj,
      'conditional',
      conditionalKeys,
      verbId,
      'missing "conditional" conjugations'
    )
  );

  return errors;
}

export function validateVerb(verb: unknown, allVerbs: Map<string, unknown>): string[] {
  const v = verb as Record<string, unknown>;
  if (!isNonEmptyString(v.id)) return ['missing or invalid "id"'];
  const verbId = v.id as string;

  return [
    ...VERB_FIELD_RULES.filter(([check]) => !check(v)).map(
      ([, message]) => `${verbId}: ${message}`
    ),
    ...validateAspectPair(v, verbId, allVerbs),
    ...validateConjugations(v, verbId),
  ];
}

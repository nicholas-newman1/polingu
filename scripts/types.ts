export type DeclensionCase =
  | 'Nominative'
  | 'Genitive'
  | 'Dative'
  | 'Accusative'
  | 'Instrumental'
  | 'Locative'
  | 'Vocative';

export type DeclensionGender = 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';

export type DeclensionNumber = 'Singular' | 'Plural';

export interface DeclensionCard {
  id: number;
  front: string;
  back: string;
  declined: string;
  case: DeclensionCase;
  gender: DeclensionGender;
  number: DeclensionNumber;
  hint?: string;
}

export interface DeclensionCardIndex {
  id: number;
  front: string;
  case: DeclensionCase;
  gender: DeclensionGender;
  number: DeclensionNumber;
}

const VALID_CASES: DeclensionCase[] = [
  'Nominative',
  'Genitive',
  'Dative',
  'Accusative',
  'Instrumental',
  'Locative',
  'Vocative',
];

const VALID_GENDERS: DeclensionGender[] = ['Masculine', 'Feminine', 'Neuter', 'Pronoun'];

const VALID_NUMBERS: DeclensionNumber[] = ['Singular', 'Plural'];

export function isValidCase(value: string): value is DeclensionCase {
  return VALID_CASES.includes(value as DeclensionCase);
}

function isValidGender(value: string): value is DeclensionGender {
  return VALID_GENDERS.includes(value as DeclensionGender);
}

function isValidNumber(value: string): value is DeclensionNumber {
  return VALID_NUMBERS.includes(value as DeclensionNumber);
}

const CARD_RULES: [check: (c: Record<string, unknown>) => boolean, message: string][] = [
  [(c) => typeof c.id === 'number', 'missing or invalid "id" (must be number)'],
  [(c) => !!c.front && typeof c.front === 'string', 'missing or invalid "front"'],
  [(c) => !!c.back && typeof c.back === 'string', 'missing or invalid "back"'],
  [(c) => !!c.declined && typeof c.declined === 'string', 'missing or invalid "declined"'],
  [
    (c) => !!c.case && isValidCase(c.case as string),
    `invalid "case" (must be one of: ${VALID_CASES.join(', ')})`,
  ],
  [
    (c) => !!c.gender && isValidGender(c.gender as string),
    `invalid "gender" (must be one of: ${VALID_GENDERS.join(', ')})`,
  ],
  [
    (c) => !!c.number && isValidNumber(c.number as string),
    `invalid "number" (must be one of: ${VALID_NUMBERS.join(', ')})`,
  ],
  [(c) => c.hint === undefined || typeof c.hint === 'string', 'hint must be a string if provided'],
];

export function validateDeclensionCard(card: unknown, index: number): card is DeclensionCard {
  const c = card as Record<string, unknown>;
  const errors = CARD_RULES.filter(([check]) => !check(c)).map(([, message]) => message);

  if (errors.length > 0) {
    console.error(`❌ Card at index ${index} has errors:`);
    errors.forEach((e) => console.error(`   - ${e}`));
    return false;
  }

  return true;
}

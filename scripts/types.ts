import { CASES, GENDERS, NUMBERS } from '../src/constants.js';
import type {
  Case as DeclensionCase,
  Gender as DeclensionGender,
  Number as DeclensionNumber,
} from '../src/types.js';

export type { DeclensionCase, DeclensionGender, DeclensionNumber };

export interface DeclensionCard {
  id: number;
  front: string;
  back: string;
  declined: string;
  case: DeclensionCase;
  gender: DeclensionGender;
  number: DeclensionNumber;
  english: string;
  hint?: string;
}

export interface DeclensionCardIndex {
  id: number;
  front: string;
  case: DeclensionCase;
  gender: DeclensionGender;
  number: DeclensionNumber;
}

export function isValidCase(value: string): value is DeclensionCase {
  return CASES.includes(value as DeclensionCase);
}

function isValidGender(value: string): value is DeclensionGender {
  return GENDERS.includes(value as DeclensionGender);
}

function isValidNumber(value: string): value is DeclensionNumber {
  return NUMBERS.includes(value as DeclensionNumber);
}

const CARD_RULES: [check: (c: Record<string, unknown>) => boolean, message: string][] = [
  [(c) => typeof c.id === 'number', 'missing or invalid "id" (must be number)'],
  [(c) => !!c.front && typeof c.front === 'string', 'missing or invalid "front"'],
  [(c) => !!c.back && typeof c.back === 'string', 'missing or invalid "back"'],
  [(c) => !!c.declined && typeof c.declined === 'string', 'missing or invalid "declined"'],
  [
    (c) => typeof c.english === 'string' && c.english.trim().length > 0,
    'missing or invalid "english" (whole-sentence translation of "back")',
  ],
  [
    (c) => !!c.case && isValidCase(c.case as string),
    `invalid "case" (must be one of: ${CASES.join(', ')})`,
  ],
  [
    (c) => !!c.gender && isValidGender(c.gender as string),
    `invalid "gender" (must be one of: ${GENDERS.join(', ')})`,
  ],
  [
    (c) => !!c.number && isValidNumber(c.number as string),
    `invalid "number" (must be one of: ${NUMBERS.join(', ')})`,
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

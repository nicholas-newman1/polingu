import { describe, expect, test } from 'vitest';
import { CASES, GENDERS, NUMBERS } from '../../src/constants';
import {
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  CONDITIONAL_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  PAST_FORM_KEYS,
  PRESENT_FORM_KEYS,
  type ConjugationForm,
  type Tense,
  type Verb,
} from '../../src/types/conjugation';
import type { DeclensionCard } from '../../src/types';
import { expectOnlyAllowlisted, readRepoJson, readRepoText } from './repo';
import { asciiVerbId } from './verbIds';

/**
 * DECLENSION.md and CONJUGATION.md are the instructions for AI-generated content, and the
 * full JSON examples in them are what generated cards and verbs get copied from. These tests
 * hold the examples to the rules the same documents state.
 */

/** Every ```json block in a document that parses on its own. */
function jsonExamples(file: string): unknown[] {
  return [...readRepoText(file).matchAll(/```json\n([\s\S]*?)```/g)].flatMap(([, body]) => {
    try {
      return [JSON.parse(body)];
    } catch {
      return []; // Fragments with "..." placeholders.
    }
  });
}

const verbIndex =
  readRepoJson<Pick<Verb, 'id' | 'infinitive' | 'aspect' | 'verbClass'>[]>('verbIndex.json');

describe('the example card in DECLENSION.md', () => {
  const [card] = jsonExamples('DECLENSION.md') as DeclensionCard[];

  test('has every field a built-in card needs, with valid values', () => {
    expect(card).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        front: expect.any(String),
        back: expect.any(String),
        declined: expect.any(String),
        english: expect.stringMatching(/\S/),
      })
    );
    expect(CASES).toContain(card.case);
    expect(GENDERS).toContain(card.gender);
    expect(NUMBERS).toContain(card.number);
  });

  test('has a back that is the front with the declined word in the blank', () => {
    const filled = card.front.replace(/___ \([^()]+\)( \(pl\))?/, card.declined);
    const withoutStop = (sentence: string) => sentence.replace(/[.!?]$/, '');
    expect(withoutStop(card.back)).toBe(withoutStop(filled));
  });

  test('ends its English with the same punctuation as the Polish back', () => {
    const stop = (sentence: string) => /[.!?]?$/.exec(sentence)![0];
    expect(stop(card.english!)).toBe(stop(card.back));
  });
});

const IMPERSONAL_KEYS = new Set(['3sg', '3pl', '3sg_m', '3sg_f', '3sg_n', '3pl_m', '3pl_f']);
const FORM_KEYS: Record<Tense, readonly string[]> = {
  present: PRESENT_FORM_KEYS,
  past: PAST_FORM_KEYS,
  future: FUTURE_FORM_KEYS,
  imperative: IMPERATIVE_FORM_KEYS,
  conditional: CONDITIONAL_FORM_KEYS,
};

/** The rules in CONJUGATION.md ("Validation Rules" and the translation guidelines). */
function conjugationProblems(verb: Verb): Map<string, string> {
  const problems = new Map<string, string>();
  const flag = (where: string, problem: string) => problems.set(`${verb.id} ${where}`, problem);
  const conjugations = verb.conjugations as Partial<Record<Tense, Record<string, ConjugationForm>>>;
  const isImperfective = verb.aspect === 'Imperfective';
  const commandless = verb.isDefective === true || verb.isImpersonal === true;
  const required: Record<Tense, boolean> = {
    present: isImperfective,
    past: true,
    future: true,
    imperative: !commandless,
    conditional: true,
  };
  for (const [tense, keys] of Object.entries(FORM_KEYS) as [Tense, string[]][]) {
    const forms = conjugations[tense];
    if (!forms) {
      if (required[tense]) flag(tense, 'missing');
      continue;
    }
    if (tense === 'imperative' && commandless)
      flag(tense, 'present on a defective/impersonal verb');
    const expected = verb.isImpersonal ? keys.filter((key) => IMPERSONAL_KEYS.has(key)) : keys;
    if (Object.keys(forms).join() !== expected.join()) {
      flag(tense, `keys ${Object.keys(forms)}`);
    }
    for (const [key, form] of Object.entries(forms)) {
      const at = `${tense}.${key}`;
      if (!form.pl?.trim()) flag(at, 'pl is empty');
      if (!form.en?.length || form.en.some((en) => !en.trim())) flag(at, 'en is empty');
      if (tense === 'future' && isImperfective && !form.plAlternatives?.length) {
        flag(at, 'imperfective future without plAlternatives');
      }
      const en = form.en ?? [];
      // The app prepends "he/she/it" to 3sg present and future translations.
      if (key === '3sg' && en.some((e) => /^(he|she|it)\b/i.test(e))) {
        flag(at, `subject pronoun in ${en}`);
      }
      if (/^3sg_/.test(key) && !en.every((e) => /^(he|she|it)\b/.test(e))) {
        flag(at, `no he/she/it in ${en}`);
      }
      if (tense === 'imperative' && !en.every((e) => e.endsWith('!'))) {
        flag(at, `not a command: ${en}`);
      }
      if (tense === 'conditional' && !en.every((e) => /\bwould\b/.test(e))) {
        flag(at, `no "would" in ${en}`);
      }
    }
  }
  return problems;
}

describe('the example verbs in CONJUGATION.md', () => {
  const verbs = (jsonExamples('CONJUGATION.md') as Verb[]).filter(
    (example) => typeof example === 'object' && 'conjugations' in example
  );

  test('include a regular and an impersonal verb to copy from', () => {
    expect(verbs.map((verb) => verb.id)).toEqual(['pisac', 'padac']);
  });

  test('use valid enum values and an id that is the ASCII spelling of the infinitive', () => {
    for (const verb of verbs) {
      expect(ALL_ASPECTS, verb.id).toContain(verb.aspect);
      expect(ALL_VERB_CLASSES, verb.id).toContain(verb.verbClass);
      expect(typeof verb.isIrregular, verb.id).toBe('boolean');
      expect(typeof verb.isReflexive, verb.id).toBe('boolean');
      expect(verb.id).toBe(asciiVerbId(verb.infinitive));
    }
  });

  test('follow the documented conjugation rules', () => {
    const problems = new Map(verbs.flatMap((verb) => [...conjugationProblems(verb)]));
    expectOnlyAllowlisted(problems, {
      // The impersonal example puts "it" in its 3sg present/future translations, which the
      // "3sg Non-Gendered Forms" rule forbids: the app would show "he/she/it it rains".
      'padac present.3sg': 'subject pronoun in it rains,it is raining',
      'padac future.3sg': 'subject pronoun in it will rain',
    });
  });

  test('agree with the verb index on aspect and class, and pair with an opposite aspect', () => {
    for (const verb of verbs) {
      const indexed = verbIndex.find((entry) => entry.id === verb.id);
      if (indexed) {
        expect({ aspect: verb.aspect, verbClass: verb.verbClass }, verb.id).toEqual({
          aspect: indexed.aspect,
          verbClass: indexed.verbClass,
        });
      }
      const pair = verbIndex.find((entry) => entry.id === verb.aspectPair);
      if (pair) expect(pair.aspect, verb.id).not.toBe(verb.aspect);
    }
    expect(verbs.some((verb) => verbIndex.some((entry) => entry.id === verb.id))).toBe(true);
  });
});

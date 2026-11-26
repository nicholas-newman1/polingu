import { describe, expect, test } from 'vitest';
import {
  ALL_ASPECTS,
  ALL_VERB_CLASSES,
  CONDITIONAL_FORM_KEYS,
  FUTURE_FORM_KEYS,
  IMPERATIVE_FORM_KEYS,
  PAST_FORM_KEYS,
  PRESENT_FORM_KEYS,
  type Aspect,
  type VerbClass,
} from '../../src/types/conjugation';
import { readRepoJson, readRepoText, violationsOf } from './repo';
import { asciiVerbId as asciiId } from './verbIds';

/**
 * verbIndex.json is the local mirror of the built-in verbs in Firestore. `verbs:import` reads
 * it to reject a verb whose id or infinitive already exists; a duplicate id would overwrite a
 * verb document and every review keyed by its form keys.
 */
interface IndexedVerb {
  id: string;
  infinitive: string;
  aspect: Aspect;
  verbClass: VerbClass;
}

const verbs = readRepoJson<IndexedVerb[]>('verbIndex.json');
const spec = readRepoText('CONJUGATION.md');

/** The regular class an infinitive's ending names; the longest match, so -ować beats -ać. */
const classByEnding = (infinitive: string) =>
  ALL_VERB_CLASSES.filter((verbClass) => verbClass !== 'Irregular')
    .sort((a, b) => b.length - a.length)
    .find((verbClass) => infinitive.replace(/ się$/, '').endsWith(verbClass.slice(1)));

describe('verb index records', () => {
  test('every verb has exactly the indexed fields, with an aspect and class the app knows', () => {
    const fields = ['aspect', 'id', 'infinitive', 'verbClass'];
    const problems = violationsOf(
      verbs,
      (verb) => verb.id,
      (verb) =>
        (Object.keys(verb).sort().join() !== fields.join() && `fields ${Object.keys(verb)}`) ||
        (!verb.infinitive?.trim() && 'empty infinitive') ||
        (!ALL_ASPECTS.includes(verb.aspect) && `aspect ${verb.aspect}`) ||
        (!ALL_VERB_CLASSES.includes(verb.verbClass) && `verbClass ${verb.verbClass}`)
    );
    expect([...problems]).toEqual([]);
  });

  test('ids are unique, and so are infinitives ignoring case', () => {
    const ids = verbs.map((verb) => verb.id);
    const infinitives = verbs.map((verb) => verb.infinitive.toLowerCase());
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(infinitives.filter((inf, i) => infinitives.indexOf(inf) !== i)).toEqual([]);
  });

  test('each id is the ASCII spelling of its infinitive', () => {
    const problems = violationsOf(
      verbs,
      (verb) => verb.id,
      (verb) => verb.id !== asciiId(verb.infinitive) && `expected ${asciiId(verb.infinitive)}`
    );
    expect([...problems]).toEqual([]);
  });

  test('a regular verb class is the ending of the infinitive', () => {
    const problems = violationsOf(
      verbs,
      (verb) => verb.id,
      ({ infinitive, verbClass }) =>
        verbClass !== 'Irregular' &&
        classByEnding(infinitive) !== verbClass &&
        `${infinitive} is not ${verbClass}`
    );
    expect([...problems]).toEqual([]);
  });

  test('verbs are sorted by infinitive in Polish alphabetical order, as sync writes them', () => {
    const infinitives = verbs.map((verb) => verb.infinitive);
    expect(infinitives).toEqual([...infinitives].sort((a, b) => a.localeCompare(b, 'pl')));
  });
});

describe('CONJUGATION.md matches the app', () => {
  const union = (name: string) => {
    const match = new RegExp(`type ${name} = ([^;]+);`).exec(spec);
    return match?.[1].split('|').map((member) => member.trim().replace(/'/g, ''));
  };

  test('the documented Aspect and VerbClass unions list the app values in order', () => {
    expect(union('Aspect')).toEqual(ALL_ASPECTS);
    expect(union('VerbClass')).toEqual(ALL_VERB_CLASSES);
  });

  test('the documented form-key unions list the app form keys in order', () => {
    expect(union('PresentFormKey')).toEqual(PRESENT_FORM_KEYS);
    expect(union('PastFormKey')).toEqual(PAST_FORM_KEYS);
    expect(union('FutureFormKey')).toEqual(FUTURE_FORM_KEYS);
    expect(union('ImperativeFormKey')).toEqual(IMPERATIVE_FORM_KEYS);
    expect(union('ConditionalFormKey')).toEqual(CONDITIONAL_FORM_KEYS);
  });

  test('the verb class table describes every class, with an example verb of that class', () => {
    const rows = [...spec.matchAll(/^\| (-\S+|Irregular) \| (\S+) → \S+ \|/gm)];
    expect(rows.map(([, verbClass]) => verbClass)).toEqual(ALL_VERB_CLASSES);
    const mismatched = rows.filter(
      ([, verbClass, example]) => verbClass !== 'Irregular' && classByEnding(example) !== verbClass
    );
    expect(mismatched.map(([row]) => row)).toEqual([]);
  });

  test('the ID-format examples follow the same ASCII rule the index is checked with', () => {
    const examples = [...spec.matchAll(/^- (.+) → `([^`]+)`$/gm)];
    expect(examples.length).toBeGreaterThan(2);
    for (const [, infinitive, id] of examples) expect(asciiId(infinitive)).toBe(id);
  });
});

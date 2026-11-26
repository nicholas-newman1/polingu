import { describe, expect, test } from 'vitest';
import {
  CONSONANT_PAIRS,
  CONSONANT_WORDS,
  getExampleWordsForConsonant,
} from '../../src/data/consonants';
import type { ConsonantWord } from '../../src/types/consonants';
import { expectOnlyAllowlisted, violationsOf } from './repo';

/**
 * Data for the hard/soft consonant driller. A word card shows only the word, its translation,
 * gender and number, and the learner answers whether its consonant is hard or soft, so a word
 * whose stem does not end in the consonant it is filed under teaches the wrong answer.
 */

/** Every consonant spelling the pair table uses, plus h; longest first so "dzi" beats "zi". */
const GRAPHEMES = [...new Set([...CONSONANT_PAIRS.flatMap((pair) => [pair.hard, pair.soft]), 'h'])]
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

/**
 * The consonant a stem ends in: kot → t, kocie → ci, ziemi → mi, koza → z, łódź → dź.
 * A soft spelling with i (ci, mi) already holds the vowel; otherwise one final vowel is dropped.
 */
function finalConsonant(word: string) {
  const lower = word.toLowerCase();
  for (const stem of [lower, lower.replace(/[aąeęioóuy]$/, '')]) {
    const grapheme = GRAPHEMES.find((g) => stem.endsWith(g));
    if (grapheme) return grapheme;
  }
}

const pairFor = (word: ConsonantWord) =>
  CONSONANT_PAIRS.find((pair) =>
    word.consonantType === 'hard' ? pair.hard === word.consonant : pair.soft === word.consonant
  );

/** "cat (loc/voc)" → ["loc", "voc"]; "armies (nom pl)" → ["nom", "pl"]. */
const CASE_LABEL =
  /\(((?:nom|gen|dat|acc|ins|loc|voc|pl)(?:[/ ](?:nom|gen|dat|acc|ins|loc|voc|pl))*)\)$/;
const caseLabel = (translation = '') => CASE_LABEL.exec(translation)?.[1].split(/[/ ]/);

const wordKey = (word: ConsonantWord) => `${word.consonantType} ${word.consonant} ${word.word}`;
const hardWords = CONSONANT_WORDS.filter((word) => word.consonantType === 'hard');
const softWords = CONSONANT_WORDS.filter((word) => word.consonantType === 'soft');
/** Words in their dictionary form: hard words, and soft words not declined from a hard one. */
const baseForms = CONSONANT_WORDS.filter((w) => w.consonantType === 'hard' || !w.hardenedForm);

describe('consonant pairs', () => {
  test('a pair has a hard consonant exactly when hasHard is set', () => {
    for (const pair of CONSONANT_PAIRS) expect(pair.hasHard, pair.soft).toBe(pair.hard !== '');
  });

  test('no consonant appears in two pairs or on both sides', () => {
    // The word driller finds a word's pair by consonant, on either side.
    const spellings = CONSONANT_PAIRS.flatMap((pair) => [pair.hard, pair.soft]).filter(Boolean);
    expect(spellings.filter((s, i) => spellings.indexOf(s) !== i)).toEqual([]);
  });

  test('word-final ń ć ź ś dź are the soft partners of n t z s d, spelt ni ci zi si dzi', () => {
    const accented = CONSONANT_PAIRS.filter((pair) => /[ńćźś]/.test(pair.soft));
    expect(accented.map((pair) => pair.soft).sort()).toEqual(['dź', 'ć', 'ń', 'ś', 'ź'].sort());
    for (const { soft } of accented) {
      const beforeVowel = `${soft.normalize('NFD').replace(/\p{M}/gu, '')}i`;
      const partner = CONSONANT_PAIRS.find((pair) => pair.soft === beforeVowel);
      expect(partner?.hasHard, `${soft} → ${beforeVowel}`).toBe(true);
    }
  });

  test('every pair has drill words for each of its consonants', () => {
    for (const pair of CONSONANT_PAIRS) {
      expect(getExampleWordsForConsonant(pair.soft).length, pair.soft).toBeGreaterThan(0);
      if (pair.hasHard) {
        expect(getExampleWordsForConsonant(pair.hard).length, pair.hard).toBeGreaterThan(0);
      }
    }
  });
});

describe('consonant drill words', () => {
  test('every word is filed under a consonant from the pair table, on the side its type names', () => {
    const orphans = CONSONANT_WORDS.filter((word) => !pairFor(word)).map(wordKey);
    expect(orphans).toEqual([]);
  });

  test('no word is listed twice', () => {
    const keys = CONSONANT_WORDS.map(wordKey);
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  test('the stem of every word ends in the consonant it is filed under', () => {
    const problems = violationsOf(
      CONSONANT_WORDS,
      wordKey,
      (word) =>
        finalConsonant(word.word) !== word.consonant && `ends in ${finalConsonant(word.word)}`
    );
    expectOnlyAllowlisted(problems, {
      // dż is the first sound; the stem ends in a hard m (w dżemie), so a learner who reads
      // the stem answers "hard" and is marked wrong.
      'soft dż dżem': 'ends in m',
      // dż is the first sound; the stem ends in c.
      'soft dż dżdżownica': 'ends in c',
      // łódź ends in dź, not ź (the dź pair already has gwóźdź and niedźwiedź).
      'soft ź łódź': 'ends in dź',
    });
  });

  test('hard words carry their softened form, soft words do not', () => {
    for (const word of hardWords) {
      expect(word.softenedForm && word.softenedTranslation, wordKey(word)).toBeTruthy();
      expect(word.hardenedForm ?? word.hardenedTranslation, wordKey(word)).toBeUndefined();
    }
    for (const word of softWords) {
      expect(word.softenedForm ?? word.softenedTranslation, wordKey(word)).toBeUndefined();
      expect(Boolean(word.hardenedForm), wordKey(word)).toBe(Boolean(word.hardenedTranslation));
    }
  });

  test('a softened form ends in the soft partner of the hard consonant, followed by -e', () => {
    const problems = violationsOf(hardWords, wordKey, (word) => {
      const form = word.softenedForm ?? '';
      const soft = pairFor(word)?.soft;
      return (!form.endsWith('e') || finalConsonant(form) !== soft) && `${form} (${soft}e)`;
    });
    expect([...problems]).toEqual([]);
  });

  test('a hardened form ends in the hard partner of the soft consonant', () => {
    const problems = violationsOf(
      softWords.filter((word) => word.hardenedForm),
      wordKey,
      (word) =>
        finalConsonant(word.hardenedForm!) !== pairFor(word)?.hard &&
        `${word.hardenedForm} ends in ${finalConsonant(word.hardenedForm!)}`
    );
    expectOnlyAllowlisted(problems, {
      // ziemia and armia have a soft stem in every form; there is no hard base to harden to,
      // yet the card shows "ziemia → ziemi" as if mi came from m.
      'soft mi ziemi': 'ziemia ends in mi',
      'soft mi armie': 'armia ends in mi',
    });
  });

  test('base forms are nominative singular, with an ending that fits their gender', () => {
    // Hard-stem feminine nouns end in -a; consonant-final feminine nouns are soft (noc, kość).
    const fits: Record<ConsonantWord['gender'], (word: ConsonantWord) => boolean> = {
      masculine: ({ word }) => !/[aąeęioóuy]$/.test(word),
      feminine: ({ word, consonantType }) =>
        /a$/.test(word) || (consonantType === 'soft' && /([^aąeęioóuy]|i)$/.test(word)),
      neuter: ({ word }) => /([oeę]|um)$/.test(word),
    };
    const problems = violationsOf(
      baseForms,
      wordKey,
      (word) =>
        (word.number !== 'singular' || !fits[word.gender](word) || caseLabel(word.translation)) &&
        `${word.gender} ${word.number}: ${word.translation}`
    );
    expect([...problems]).toEqual([]);
  });

  test('declined forms are labelled with cases that take -e for their gender, and their number', () => {
    // Singular -e forms: masculine locative/vocative (kocie), neuter locative (oknie),
    // feminine dative/locative (rybie). Never nominative, genitive, accusative or instrumental.
    const eCases = { masculine: ['loc', 'voc'], neuter: ['loc'], feminine: ['loc', 'dat'] };
    const declined = [
      ...hardWords.map((word) => ({
        ...word,
        form: word.softenedForm!,
        label: word.softenedTranslation,
      })),
      ...softWords
        .filter((word) => word.hardenedForm)
        .map((word) => ({ ...word, form: word.word, label: word.translation })),
    ];
    const problems = violationsOf(
      declined,
      (word) => `${wordKey(word)} → ${word.form}`,
      ({ form, label, gender, number }) => {
        const cases = caseLabel(label);
        if (!cases) return `no case label: ${label}`;
        if (cases.includes('pl') !== (number === 'plural')) return `${number}: ${label}`;
        const unexpected = cases.filter((c) => !eCases[gender].includes(c));
        if (number === 'singular' && form.endsWith('e') && unexpected.length > 0) {
          return `${gender} -e form labelled ${label}`;
        }
      }
    );
    expect([...problems]).toEqual([]);
  });

  test('a hard word and the soft word made from it point at each other and agree', () => {
    let linked = 0;
    for (const hard of hardWords) {
      const soft = softWords.find((word) => word.word === hard.softenedForm);
      if (!soft) continue;
      linked++;
      expect(
        {
          hardenedForm: soft.hardenedForm,
          hardenedTranslation: soft.hardenedTranslation,
          translation: soft.translation,
          consonant: soft.consonant,
          gender: soft.gender,
          number: soft.number,
        },
        wordKey(hard)
      ).toEqual({
        hardenedForm: hard.word,
        hardenedTranslation: hard.translation,
        translation: hard.softenedTranslation,
        consonant: pairFor(hard)?.soft,
        gender: hard.gender,
        number: hard.number,
      });
    }
    for (const soft of softWords.filter((word) => word.hardenedForm)) {
      const hard = hardWords.find((word) => word.word === soft.hardenedForm);
      if (hard) expect(hard.softenedForm, wordKey(soft)).toBe(soft.word);
    }
    expect(linked).toBeGreaterThan(20);
  });
});

describe('getExampleWordsForConsonant', () => {
  test('returns the first words filed under that consonant, in list order, up to the limit', () => {
    const all = CONSONANT_WORDS.filter((word) => word.consonant === 'ci');
    expect(all.length).toBeGreaterThan(3);
    expect(getExampleWordsForConsonant('ci')).toEqual(all.slice(0, 3));
    expect(getExampleWordsForConsonant('ci', 5)).toEqual(all.slice(0, 5));
    expect(getExampleWordsForConsonant('ci', 100)).toEqual(all);
  });

  test('matches the consonant exactly, so c does not return ci, cz or ch words', () => {
    const words = getExampleWordsForConsonant('c', 100);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((word) => word.consonant === 'c')).toBe(true);
  });

  test('returns nothing for a consonant with no words', () => {
    expect(getExampleWordsForConsonant('x')).toEqual([]);
  });
});

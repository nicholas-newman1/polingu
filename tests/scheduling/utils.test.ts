import { describe, expect, test, vi } from 'vitest';
import capitalize from '../../src/lib/utils/capitalize';
import { countWords } from '../../src/lib/utils/countWords';
import { findCustomDeclensionDuplicate } from '../../src/lib/utils/findDuplicateCustomDeclension';
import { findCustomSentenceWithSamePolish } from '../../src/lib/utils/findDuplicateCustomSentence';
import { findWordWithSamePolish } from '../../src/lib/utils/findDuplicateCustomVocabularyPolish';
import { formatDuration } from '../../src/lib/utils/formatDuration';
import getFirstName from '../../src/lib/utils/getFirstName';
import { normalizeCustomVocabularyFields } from '../../src/lib/utils/normalizeCustomVocabularyFields';
import { withNextSentenceIds } from '../../src/lib/sentences/sentenceIds';
import { normalizeVocabularyPrefill } from '../../src/lib/utils/normalizeVocabularyPrefill';
import shuffleArray, { balancedShuffle } from '../../src/lib/utils/shuffleArray';
import toggleInArray from '../../src/lib/utils/toggleInArray';
import type { CustomDeclensionCard } from '../../src/types';
import type { CustomSentence } from '../../src/types/sentences';
import type { CustomVocabularyWord } from '../../src/types/vocabulary';
import { stub } from '../helpers/stub';

describe('duplicate custom cards', () => {
  const declension = (id: string, overrides: Partial<CustomDeclensionCard> = {}) =>
    stub<CustomDeclensionCard>({
      id,
      front: 'kot',
      declined: 'kota',
      case: 'Genitive',
      gender: 'Masculine',
      number: 'Singular',
      ...overrides,
    });
  const existing = [declension('custom_1'), declension('custom_2', { case: 'Accusative' })];

  test('a declension card with the same words and grammar, ignoring case and spacing, is a duplicate', () => {
    const candidate = { ...declension('new'), front: '  KOT ', declined: 'Kota' };
    expect(findCustomDeclensionDuplicate(existing, candidate)?.id).toBe('custom_1');
  });

  test('the same words in another case, gender or number are not duplicates', () => {
    expect(findCustomDeclensionDuplicate(existing, declension('n', { case: 'Dative' }))).toBe(
      undefined
    );
    expect(
      findCustomDeclensionDuplicate(existing, declension('n', { gender: 'Feminine' }))
    ).toBeUndefined();
    expect(
      findCustomDeclensionDuplicate(existing, declension('n', { number: 'Plural' }))
    ).toBeUndefined();
  });

  test('editing a declension card is not a duplicate of itself, and blanks match nothing', () => {
    expect(findCustomDeclensionDuplicate(existing, declension('custom_1'), 'custom_1')).toBe(
      undefined
    );
    expect(
      findCustomDeclensionDuplicate(existing, declension('n', { front: '  ' }))
    ).toBeUndefined();
  });

  test('a sentence with the same Polish, ignoring case and spacing, is a duplicate', () => {
    const sentences = [stub<CustomSentence>({ id: 's1', polish: 'Mam  kota.' })];
    expect(findCustomSentenceWithSamePolish(sentences, ' mam kota. ')?.id).toBe('s1');
    expect(findCustomSentenceWithSamePolish(sentences, 'mam kota', undefined)).toBeUndefined();
    expect(findCustomSentenceWithSamePolish(sentences, 'Mam kota.', 's1')).toBeUndefined();
    expect(findCustomSentenceWithSamePolish(sentences, '   ')).toBeUndefined();
  });

  test('a word with the same Polish, ignoring case, spacing and punctuation, is a duplicate', () => {
    const words = [stub<CustomVocabularyWord>({ id: 'w1', polish: 'dzień dobry' })];
    expect(findWordWithSamePolish(words, 'Dzień dobry!')?.id).toBe('w1');
    expect(findWordWithSamePolish(words, 'dzien dobry')).toBeUndefined();
    expect(findWordWithSamePolish(words, 'dzień dobry', 'w1')).toBeUndefined();
    expect(findWordWithSamePolish(words, '?!')).toBeUndefined();
  });
});

describe('normalising custom vocabulary', () => {
  test('prefill text is lower-cased with punctuation and extra spaces removed, keeping diacritics', () => {
    expect(normalizeVocabularyPrefill('  Dzień   dobry! ')).toBe('dzień dobry');
    expect(normalizeVocabularyPrefill('Co, to?')).toBe('co to');
    expect(normalizeVocabularyPrefill('„Żółć”')).toBe('żółć');
    expect(normalizeVocabularyPrefill('...')).toBe('');
    expect(normalizeVocabularyPrefill('   ')).toBe('');
  });

  test('saved words are trimmed and lower-cased, other fields untouched', () => {
    const input = {
      polish: '  Dom ',
      english: 'House ',
      notes: 'Keep Me',
      partOfSpeech: 'noun',
    };
    expect(normalizeCustomVocabularyFields(input)).toEqual({
      polish: 'dom',
      english: 'house',
      notes: 'Keep Me',
      partOfSpeech: 'noun',
    });

    const word = stub<CustomVocabularyWord>({
      id: 'custom_1',
      isCustom: true,
      createdAt: 5,
      polish: 'KOT',
      english: ' Cat',
    });
    expect(normalizeCustomVocabularyFields(word)).toEqual({
      id: 'custom_1',
      isCustom: true,
      createdAt: 5,
      polish: 'kot',
      english: 'cat',
    });
  });
});

describe('ids for new built-in sentences', () => {
  test('follow the highest number per level, not alphabetical order', () => {
    const existing = ['a1_2', 'a1_10', 'a1_9', 'b2_1', 'custom_123', 'c1_x'].map((id) => ({ id }));
    const added = withNextSentenceIds(existing, [
      { level: 'A1' as const },
      { level: 'B2' as const },
      { level: 'A1' as const },
      { level: 'C2' as const },
    ]);

    expect(added.map((s) => s.id)).toEqual(['a1_011', 'b2_002', 'a1_012', 'c2_001']);
  });
});

describe('text and time formatting', () => {
  test.each([
    [0, '0:00'],
    [5.9, '0:05'],
    [59.99, '0:59'],
    [61, '1:01'],
    [3600, '60:00'],
    [-1, '0:00'],
    [Number.NaN, '0:00'],
    [Number.POSITIVE_INFINITY, '0:00'],
  ])('%s seconds is shown as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  test('words are counted across any whitespace', () => {
    expect(countWords('Mam  kota,\n\ti psa.')).toBe(4);
    expect(countWords('  ')).toBe(0);
    expect(countWords('')).toBe(0);
  });

  test('capitalize raises the first letter only, Polish letters included', () => {
    expect(capitalize('łódź')).toBe('Łódź');
    expect(capitalize('dOM')).toBe('DOM');
    expect(capitalize('')).toBe('');
  });

  test('the first name comes from the display name, else the email', () => {
    expect(getFirstName('Anna Nowak', 'anna@example.com')).toBe('Anna');
    expect(getFirstName(null, 'jan.kowalski@example.com')).toBe('jan.kowalski');
    expect(getFirstName('', null)).toBe('');
    expect(getFirstName(null, null)).toBe('');
  });
});

describe('arrays', () => {
  test('toggling adds a missing item and removes a present one, without mutating', () => {
    const items = ['A1', 'B1'];
    expect(toggleInArray(items, 'C1')).toEqual(['A1', 'B1', 'C1']);
    expect(toggleInArray(items, 'A1')).toEqual(['B1']);
    expect(items).toEqual(['A1', 'B1']);
  });

  test('shuffling returns every item exactly once in a new array', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    for (let run = 0; run < 20; run++) {
      const shuffled = shuffleArray(items);
      expect(shuffled).not.toBe(items);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    }
    expect(shuffleArray([])).toEqual([]);
  });

  test('a balanced shuffle keeps runs of one answer type within the limit when that is possible', () => {
    // The consonant driller relies on this so "hard" or "soft" never comes up many times in
    // a row. Math.random is seeded, so the run is the same every time; a plain shuffle of
    // 4 + 4 items breaks the limit in about half of all runs.
    let seed = 42;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      // mulberry32
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    });
    const cards = ['h1', 'h2', 'h3', 'h4', 's1', 's2', 's3', 's4'];
    const type = (card: string) => card[0];
    const longestRun = (order: string[]) =>
      order.reduce(
        ({ best, run }, card, i) => {
          const next = i > 0 && type(order[i - 1]) === type(card) ? run + 1 : 1;
          return { best: Math.max(best, next), run: next };
        },
        { best: 0, run: 0 }
      ).best;

    for (let round = 0; round < 30; round++) {
      const order = balancedShuffle(cards, type, 2);
      expect([...order].sort()).toEqual(cards);
      expect(longestRun(order), order.join()).toBeLessThanOrEqual(2);
    }
  });

  test('a balanced shuffle returns every item, and gives up when balance is impossible', () => {
    const mixed = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'];
    const type = (s: string) => s[0];
    expect([...balancedShuffle(mixed, type)].sort()).toEqual(mixed);

    const allSame = ['a1', 'a2', 'a3', 'a4', 'a5'];
    expect([...balancedShuffle(allSame, type)].sort()).toEqual(allSame);
  });
});

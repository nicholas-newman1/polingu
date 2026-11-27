import { describe, expect, test } from 'vitest';
import { foldForSearch, matchesSearch } from '../../src/lib/utils/foldForSearch';
import { containsWholePhrase } from '../../src/lib/utils/containsWholePhrase';
import { findWordWithSamePolish } from '../../src/lib/utils/findDuplicateCustomVocabularyPolish';

describe('foldForSearch', () => {
  test('lower-cases and strips every Polish diacritic, including ł', () => {
    expect(foldForSearch('ŻÓŁĆ ąęśńźŁ')).toBe('zolc aesnzl');
    expect(foldForSearch('żyrafa')).toBe('zyrafa');
  });

  test('handles text already in decomposed form', () => {
    expect(foldForSearch('żyrafa')).toBe('zyrafa');
  });
});

describe('matchesSearch', () => {
  test('finds a query typed without diacritics or in another case', () => {
    expect(matchesSearch(foldForSearch('zyraf'), 'żyrafa')).toBe(true);
    expect(matchesSearch(foldForSearch('L'), 'łódź')).toBe(true);
    expect(matchesSearch(foldForSearch('ŻYR'), 'żyrafa')).toBe(true);
  });

  test('checks every field and skips missing ones', () => {
    expect(matchesSearch('cat', 'kot', undefined, 'Cat')).toBe(true);
    expect(matchesSearch('dog', 'kot', null, 'cat')).toBe(false);
  });

  test('an empty query matches everything', () => {
    expect(matchesSearch('', 'kot')).toBe(true);
  });
});

describe('containsWholePhrase', () => {
  test('matches a whole word, ignoring case and punctuation', () => {
    expect(containsWholePhrase('Nie mam kota.', 'kota')).toBe(true);
    expect(containsWholePhrase('„Kota” nie mam!', 'KOTA')).toBe(true);
    expect(containsWholePhrase('Nie mam żółwia, ale mam psa.', 'żółwia')).toBe(true);
  });

  test('does not match part of a word', () => {
    expect(containsWholePhrase('Nie mam kota.', 'kot')).toBe(false);
    expect(containsWholePhrase('Nie mam kotka.', 'kota')).toBe(false);
  });

  test('matches a phrase of several words only in order and side by side', () => {
    expect(containsWholePhrase('Widzę mojego kota.', 'mojego kota')).toBe(true);
    expect(containsWholePhrase('Widzę kota mojego.', 'mojego kota')).toBe(false);
  });

  test('a blank phrase never matches', () => {
    expect(containsWholePhrase('Nie mam kota.', '  ')).toBe(false);
  });
});

describe('findWordWithSamePolish', () => {
  const words = [
    { id: 79, polish: 'dom' },
    { id: 'custom_1', polish: 'Kot' },
  ];

  test('finds a built-in or custom word ignoring case, spacing and punctuation', () => {
    expect(findWordWithSamePolish(words, ' DOM ')?.id).toBe(79);
    expect(findWordWithSamePolish(words, 'kot.')?.id).toBe('custom_1');
    expect(findWordWithSamePolish(words, 'pies')).toBeUndefined();
  });

  test('can leave out the word being edited', () => {
    expect(findWordWithSamePolish(words, 'kot', 'custom_1')).toBeUndefined();
  });
});

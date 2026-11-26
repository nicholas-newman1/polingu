import { describe, expect, test } from 'vitest';
import { parseTextParagraphs } from '../../src/lib/reader';

describe('splitting a text book into paragraphs', () => {
  test('blank lines separate paragraphs', () => {
    expect(parseTextParagraphs('Pierwszy akapit.\n\nDrugi akapit.')).toEqual([
      'Pierwszy akapit.',
      'Drugi akapit.',
    ]);
  });

  test('lines wrapped inside a paragraph are joined with spaces', () => {
    expect(parseTextParagraphs('Ala ma\nkota,\na kot ma Alę.\n\nKoniec.')).toEqual([
      'Ala ma kota, a kot ma Alę.',
      'Koniec.',
    ]);
  });

  test('Windows line endings and whitespace-only separator lines are handled', () => {
    expect(parseTextParagraphs('Raz\r\ndwa\r\n   \r\nTrzy')).toEqual(['Raz dwa', 'Trzy']);
  });

  test('surrounding whitespace and extra blank lines produce no empty paragraphs', () => {
    expect(parseTextParagraphs('\n\n  Jeden  \n\n\n\n\tDwa\t\n\n')).toEqual(['Jeden', 'Dwa']);
    expect(parseTextParagraphs('   \n\n  ')).toEqual([]);
    expect(parseTextParagraphs('')).toEqual([]);
  });
});

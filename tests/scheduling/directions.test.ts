import { expect, test } from 'vitest';
import {
  DIRECTION_ROUTES,
  otherDirection,
  toModeStats,
} from '../../src/lib/reviewSession/directions';

test('recognition is Polish to English and production is English to Polish', () => {
  expect(DIRECTION_ROUTES['pl-to-en']).toEqual({ route: 'recognition', label: 'Recognition' });
  expect(DIRECTION_ROUTES['en-to-pl']).toEqual({ route: 'production', label: 'Production' });
});

test('the other direction of each direction is its opposite', () => {
  expect(otherDirection('pl-to-en')).toBe('en-to-pl');
  expect(otherDirection('en-to-pl')).toBe('pl-to-en');
});

test('mode stats keep each direction’s counts apart', () => {
  expect(
    toModeStats({
      'pl-to-en': { due: 3, learned: 40, total: 100 },
      'en-to-pl': { due: 8, learned: 12, total: 100 },
    })
  ).toEqual({
    'pl-to-en': { dueCount: 3, learnedCount: 40, totalCount: 100 },
    'en-to-pl': { dueCount: 8, learnedCount: 12, totalCount: 100 },
  });
});

test('mode stats show zeros for a direction with no counts yet', () => {
  const zeros = { dueCount: 0, learnedCount: 0, totalCount: 0 };
  expect(toModeStats(undefined)).toEqual({ 'pl-to-en': zeros, 'en-to-pl': zeros });
  expect(toModeStats({ 'en-to-pl': { due: 1, learned: 2, total: 3 } })).toEqual({
    'pl-to-en': zeros,
    'en-to-pl': { dueCount: 1, learnedCount: 2, totalCount: 3 },
  });
});

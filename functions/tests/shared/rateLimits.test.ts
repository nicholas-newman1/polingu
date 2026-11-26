import { afterEach, describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import {
  cacheKeyAppearsInSource,
  cleanTextForCacheKey,
  getNextMidnightUTC,
  reserveTranslationBudget,
} from '../../src/shared/rateLimits.js';
import { db, installFakes } from '../support/sdk.js';
import { MINUTE, SECOND } from '../support/clock.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));

installFakes();

const USER = 'learner-1';
const LIMIT_DOC = `userRateLimits/${USER}`;
const RESET = '2026-11-27T00:00:00.000Z';

function at(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(HttpsError);
  return error as HttpsError;
}

describe('reserveTranslationBudget', () => {
  test('a first translation records the characters and the request', async () => {
    at('2026-11-26T15:00:00Z');
    const { charsUsedAfter } = await reserveTranslationBudget(USER, 42, false, RESET);

    expect(charsUsedAfter).toBe(42);
    expect(db.data(LIMIT_DOC)).toEqual({
      dailyCharsUsed: 42,
      dailyCharsDate: '2026-11-26',
      recentRequests: [Date.parse('2026-11-26T15:00:00Z')],
    });
  });

  test('characters accumulate across translations on the same UTC day', async () => {
    at('2026-11-26T15:00:00Z');
    await reserveTranslationBudget(USER, 100, false, RESET);
    at('2026-11-26T18:00:00Z');
    const { charsUsedAfter } = await reserveTranslationBudget(USER, 250, false, RESET);

    expect(charsUsedAfter).toBe(350);
    expect(db.data(LIMIT_DOC)?.dailyCharsUsed).toBe(350);
  });

  test('a translation that lands exactly on the 1500 character daily limit is allowed', async () => {
    at('2026-11-26T15:00:00Z');
    db.seed(LIMIT_DOC, { dailyCharsUsed: 1000, dailyCharsDate: '2026-11-26', recentRequests: [] });

    const { charsUsedAfter } = await reserveTranslationBudget(USER, 500, false, RESET);
    expect(charsUsedAfter).toBe(1500);
  });

  test('a translation that would exceed the daily limit is refused and nothing is charged', async () => {
    at('2026-11-26T15:00:00Z');
    const seeded = { dailyCharsUsed: 1000, dailyCharsDate: '2026-11-26', recentRequests: [] };
    db.seed(LIMIT_DOC, seeded);

    const error = await rejection(reserveTranslationBudget(USER, 501, false, RESET));
    expect(error.code).toBe('resource-exhausted');
    expect(error.message).toBe(`RATE_LIMIT_DAILY:${RESET}`);
    expect(db.data(LIMIT_DOC)).toEqual(seeded);
  });

  test('the daily allowance resets at midnight UTC, which is 7 pm in Toronto in winter', async () => {
    at('2026-11-26T23:59:59Z'); // 18:59:59 in Toronto
    db.seed(LIMIT_DOC, { dailyCharsUsed: 1500, dailyCharsDate: '2026-11-26', recentRequests: [] });
    await rejection(reserveTranslationBudget(USER, 1, false, RESET));

    at('2026-11-27T00:00:00Z'); // 19:00 in Toronto, same local day
    const { charsUsedAfter } = await reserveTranslationBudget(USER, 30, false, RESET);
    expect(charsUsedAfter).toBe(30);
    expect(db.data(LIMIT_DOC)?.dailyCharsDate).toBe('2026-11-27');
  });

  test('local midnight in Toronto does not reset the allowance', async () => {
    // The learner uses up the whole allowance just before midnight in Toronto...
    at('2026-11-27T04:59:00Z'); // 23:59 on Nov 26 in Toronto
    await reserveTranslationBudget(USER, 1500, false, RESET);

    // ...and is still refused just after it, because the UTC day has not changed.
    at('2026-11-27T05:01:00Z'); // 00:01 on Nov 27 in Toronto
    const error = await rejection(reserveTranslationBudget(USER, 1, false, RESET));
    expect(error.message).toBe(`RATE_LIMIT_DAILY:${RESET}`);
    expect(db.data(LIMIT_DOC)?.dailyCharsUsed).toBe(1500);
  });

  test('allows 120 requests in a minute and refuses the 121st', async () => {
    at('2026-11-26T15:00:00Z');
    const now = Date.now();
    const recentRequests = Array.from({ length: 119 }, (_, i) => now - 50 * SECOND + i);
    db.seed(LIMIT_DOC, { dailyCharsUsed: 0, dailyCharsDate: '2026-11-26', recentRequests });

    await reserveTranslationBudget(USER, 1, false, RESET); // the 120th
    const error = await rejection(reserveTranslationBudget(USER, 1, false, RESET));
    expect(error.code).toBe('resource-exhausted');
    expect(error.message).toBe('RATE_LIMIT_MINUTE');
  });

  test('requests older than a minute no longer count and are pruned', async () => {
    at('2026-11-26T15:00:00Z');
    const now = Date.now();
    const old = Array.from({ length: 120 }, (_, i) => now - MINUTE - i);
    db.seed(LIMIT_DOC, { dailyCharsUsed: 0, dailyCharsDate: '2026-11-26', recentRequests: old });

    await reserveTranslationBudget(USER, 1, false, RESET);
    expect(db.data(LIMIT_DOC)?.recentRequests).toEqual([now]);
  });

  test('admins are never limited but their usage is still recorded', async () => {
    at('2026-11-26T15:00:00Z');
    const now = Date.now();
    db.seed(LIMIT_DOC, {
      dailyCharsUsed: 1500,
      dailyCharsDate: '2026-11-26',
      recentRequests: Array.from({ length: 200 }, (_, i) => now - i),
    });

    const { charsUsedAfter } = await reserveTranslationBudget(USER, 400, true, RESET);
    expect(charsUsedAfter).toBe(1900);
    expect(db.data(LIMIT_DOC)?.dailyCharsUsed).toBe(1900);
  });

  test('a document with missing fields is treated as no usage', async () => {
    at('2026-11-26T15:00:00Z');
    db.seed(LIMIT_DOC, { dailyCharsDate: '2026-11-26' });

    const { charsUsedAfter } = await reserveTranslationBudget(USER, 10, false, RESET);
    expect(charsUsedAfter).toBe(10);
  });

  test('limits are tracked per user', async () => {
    at('2026-11-26T15:00:00Z');
    db.seed(LIMIT_DOC, { dailyCharsUsed: 1500, dailyCharsDate: '2026-11-26', recentRequests: [] });

    const { charsUsedAfter } = await reserveTranslationBudget('someone-else', 10, false, RESET);
    expect(charsUsedAfter).toBe(10);
  });
});

describe('getNextMidnightUTC', () => {
  test('is the next 00:00 UTC, even late in the evening in Toronto', () => {
    at('2026-11-27T03:30:00Z'); // 22:30 on Nov 26 in Toronto
    expect(getNextMidnightUTC()).toBe('2026-11-28T00:00:00.000Z');
  });

  test('rolls over the month and year', () => {
    at('2026-12-31T23:59:59Z');
    expect(getNextMidnightUTC()).toBe('2027-01-01T00:00:00.000Z');
  });

  test('at exactly midnight UTC it is a full day away', () => {
    at('2026-03-08T00:00:00Z');
    expect(getNextMidnightUTC()).toBe('2026-03-09T00:00:00.000Z');
  });

  test('is unaffected by the daylight saving change in Toronto', () => {
    at('2026-03-08T06:30:00Z'); // 01:30 EST, half an hour before clocks spring forward
    expect(getNextMidnightUTC()).toBe('2026-03-09T00:00:00.000Z');
  });
});

describe('cleanTextForCacheKey', () => {
  test('lowercases, keeps Polish letters and collapses punctuation and spacing', () => {
    expect(cleanTextForCacheKey('  Żółć, GĘŚLĄ!\tjaźń  ')).toBe('żółć gęślą jaźń');
  });

  test('keeps digits and drops letters outside Polish', () => {
    expect(cleanTextForCacheKey('Café 2 razy')).toBe('caf 2 razy');
  });

  test('is empty for text with nothing to key on', () => {
    expect(cleanTextForCacheKey('?!… —')).toBe('');
  });
});

describe('cacheKeyAppearsInSource', () => {
  test('matches a whole word regardless of case and punctuation in the source', () => {
    expect(cacheKeyAppearsInSource('kota', 'Widzę KOTA, który śpi.')).toBe(true);
  });

  test('matches a multi-word phrase', () => {
    expect(cacheKeyAppearsInSource('na stole', 'Kot leży na stole.')).toBe(true);
  });

  test('does not match part of a longer word', () => {
    expect(cacheKeyAppearsInSource('kot', 'Mam kotka.')).toBe(false);
  });

  test('does not match when the source or key is empty', () => {
    expect(cacheKeyAppearsInSource('', 'Kot')).toBe(false);
    expect(cacheKeyAppearsInSource('kot', '')).toBe(false);
    expect(cacheKeyAppearsInSource('kot', '...')).toBe(false);
  });
});

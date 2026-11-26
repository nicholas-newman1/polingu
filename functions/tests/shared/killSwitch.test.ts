import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { assertNotKilled, isKilled } from '../../src/shared/killSwitch.js';
import { db, installFakes } from '../support/sdk.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));

installFakes();

const KILL_SWITCH = 'config/killSwitch';

// The kill switch is cached for 30 seconds from the last read, and a test may move the
// clock forward by up to a minute, so each test starts ten minutes after the previous
// one: no test can see a document cached by another.
let clock = Date.UTC(2026, 10, 26, 12);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 10 * 60_000;
  vi.setSystemTime(clock);
});

describe('isKilled', () => {
  test('nothing is disabled when the kill switch document does not exist', async () => {
    expect(await isKilled('translate')).toBe(false);
    expect(await isKilled('audio')).toBe(false);
    expect(await isKilled('books')).toBe(false);
  });

  test.each([
    ['translate', 'translateDisabled'],
    ['audio', 'audioDisabled'],
    ['books', 'booksDisabled'],
  ] as const)('the %s flag reads %s and no other flag', async (flag, field) => {
    db.seed(KILL_SWITCH, { [field]: true });
    expect(await isKilled(flag)).toBe(true);
    for (const other of (['translate', 'audio', 'books'] as const).filter((f) => f !== flag)) {
      expect(await isKilled(other)).toBe(false);
    }
  });

  test('fails open when the kill switch cannot be read', async () => {
    db.failReads(KILL_SWITCH);
    expect(await isKilled('translate')).toBe(false);
  });
});

describe('assertNotKilled', () => {
  test('rejects with unavailable when the service is disabled', async () => {
    db.seed(KILL_SWITCH, { audioDisabled: true, reason: 'cost spike' });
    const error = await assertNotKilled('audio').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpsError);
    expect(error).toMatchObject({ code: 'unavailable' });
  });

  test('resolves when only a different service is disabled', async () => {
    db.seed(KILL_SWITCH, { audioDisabled: true });
    await expect(assertNotKilled('translate')).resolves.toBeUndefined();
  });
});

describe('caching', () => {
  test('a flag flipped on takes effect once the 30 second cache expires', async () => {
    expect(await isKilled('translate')).toBe(false);

    db.seed(KILL_SWITCH, { translateDisabled: true });
    vi.setSystemTime(clock + 29_000);
    expect(await isKilled('translate')).toBe(false);

    vi.setSystemTime(clock + 30_001);
    expect(await isKilled('translate')).toBe(true);
  });

  test('a failed read is retried after the cache expires rather than failing open forever', async () => {
    // The document already says books are disabled, but it cannot be read yet.
    db.seed(KILL_SWITCH, { booksDisabled: true });
    db.failReads(KILL_SWITCH);
    expect(await isKilled('books')).toBe(false);

    db.reset();
    db.seed(KILL_SWITCH, { booksDisabled: true });
    vi.setSystemTime(clock + 30_001);
    expect(await isKilled('books')).toBe(true);
  });
});

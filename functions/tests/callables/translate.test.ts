import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { translate } from '../../src/callables/translate.js';
import { DEEPL_KEY, createUser, db, installFakes } from '../support/sdk.js';
import { call } from '../support/invoke.js';
import { DAY, installTestClock, setUtcTime, utcDate } from '../support/clock.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));

installFakes();
installTestClock();

const learner = createUser('learner-1');
const admin = createUser('admin-1', { admin: true });
const LIMIT_DOC = `userRateLimits/${learner.uid}`;

type DeepLBody = {
  text: string[];
  source_lang: string;
  target_lang: string;
  context?: string;
  custom_instructions?: string[];
};

let deeplRequests: Array<{ url: string; headers: Record<string, string>; body: DeepLBody }>;

/** Stubs fetch with a DeepL API that answers `translation`. */
function deeplReturns(translation: string | null, status = 200) {
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    deeplRequests.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string) as DeepLBody,
    });
    const payload =
      translation === null ? { translations: [] } : { translations: [{ text: translation }] };
    return new Response(status === 200 ? JSON.stringify(payload) : 'quota exceeded', { status });
  });
}

beforeEach(() => {
  deeplRequests = [];
  deeplReturns('the cat');
});

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

describe('access', () => {
  test('signed-out callers are rejected before anything is charged or translated', async () => {
    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }));
    expect(error.code).toBe('unauthenticated');
    expect(deeplRequests).toHaveLength(0);
    expect(db.writes).toHaveLength(0);
  });

  test('a signed-in learner gets the translation and their running total', async () => {
    const result = await call(translate, { text: 'kot', targetLang: 'EN' }, learner);

    expect(result).toEqual({
      translatedText: 'the cat',
      charsUsedToday: 3,
      resetTime: new Date(Date.parse(utcDate()) + DAY).toISOString(),
    });
  });
});

describe('input validation', () => {
  test.each([
    ['missing text', { targetLang: 'EN' }, 'Text is required.'],
    ['empty text', { text: '', targetLang: 'EN' }, 'Text is required.'],
    ['non-string text', { text: 42, targetLang: 'EN' }, 'Text is required.'],
    ['text over 500 characters', { text: 'a'.repeat(501), targetLang: 'EN' }, 'TEXT_TOO_LONG'],
    [
      'an unsupported language',
      { text: 'kot', targetLang: 'DE' },
      'Target language must be EN or PL.',
    ],
    [
      'context over 1000 characters',
      { text: 'kot', targetLang: 'EN', context: 'x'.repeat(1001) },
      'Context too long.',
    ],
    [
      'a non-boolean vocabulary flag',
      { text: 'kot', targetLang: 'EN', vocabulary: 'yes' },
      'Vocabulary must be a boolean.',
    ],
  ])('rejects %s without charging the learner', async (_case, data, message) => {
    const error = await rejection(call(translate, data as never, learner));
    expect(error.code).toBe('invalid-argument');
    expect(error.message).toBe(message);
    expect(db.data(LIMIT_DOC)).toBeUndefined();
    expect(deeplRequests).toHaveLength(0);
  });

  test('accepts text of exactly 500 characters', async () => {
    const result = await call(translate, { text: 'a'.repeat(500), targetLang: 'PL' }, learner);
    expect(result.charsUsedToday).toBe(500);
  });
});

describe('kill switch', () => {
  test('blocks learners with unavailable while translation is disabled', async () => {
    db.seed('config/killSwitch', { translateDisabled: true });

    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }, learner));
    expect(error.code).toBe('unavailable');
    expect(deeplRequests).toHaveLength(0);
    expect(db.data(LIMIT_DOC)).toBeUndefined();
  });

  test('does not block admins', async () => {
    db.seed('config/killSwitch', { translateDisabled: true });

    const result = await call(translate, { text: 'kot', targetLang: 'EN' }, admin);
    expect(result.translatedText).toBe('the cat');
  });

  test('a disabled audio service does not block translation', async () => {
    db.seed('config/killSwitch', { audioDisabled: true, booksDisabled: true });

    const result = await call(translate, { text: 'kot', targetLang: 'EN' }, learner);
    expect(result.translatedText).toBe('the cat');
  });
});

describe('rate limits', () => {
  test('refuses a learner over the daily character limit without calling DeepL', async () => {
    db.seed(LIMIT_DOC, { dailyCharsUsed: 1499, dailyCharsDate: utcDate(), recentRequests: [] });

    const error = await rejection(call(translate, { text: 'ok', targetLang: 'EN' }, learner));
    expect(error.code).toBe('resource-exhausted');
    expect(error.message).toMatch(/^RATE_LIMIT_DAILY:\d{4}-\d\d-\d\dT00:00:00\.000Z$/);
    expect(deeplRequests).toHaveLength(0);
  });

  test('refuses a learner over the per-minute request limit', async () => {
    const now = Date.now();
    db.seed(LIMIT_DOC, {
      dailyCharsUsed: 0,
      dailyCharsDate: utcDate(),
      recentRequests: Array.from({ length: 120 }, (_, i) => now - i),
    });

    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }, learner));
    expect(error.message).toBe('RATE_LIMIT_MINUTE');
    expect(deeplRequests).toHaveLength(0);
  });

  test('admins are not limited', async () => {
    db.seed(`userRateLimits/${admin.uid}`, {
      dailyCharsUsed: 5000,
      dailyCharsDate: utcDate(),
      recentRequests: [],
    });

    const result = await call(translate, { text: 'kot', targetLang: 'EN' }, admin);
    expect(result.charsUsedToday).toBe(5003);
  });

  test('yesterday’s usage (UTC) does not count against today', async () => {
    setUtcTime(0, 0, 30);
    db.seed(LIMIT_DOC, {
      dailyCharsUsed: 1500,
      dailyCharsDate: utcDate(Date.now() - 60_000),
      recentRequests: [],
    });

    const result = await call(translate, { text: 'kot', targetLang: 'EN' }, learner);
    expect(result.charsUsedToday).toBe(3);
  });
});

describe('DeepL request', () => {
  test('translates Polish to English with the API key', async () => {
    await call(translate, { text: 'kot', targetLang: 'EN' }, learner);

    expect(deeplRequests).toHaveLength(1);
    expect(deeplRequests[0].url).toBe('https://api-free.deepl.com/v2/translate');
    expect(deeplRequests[0].headers.Authorization).toBe(`DeepL-Auth-Key ${DEEPL_KEY}`);
    expect(deeplRequests[0].body).toEqual({ text: ['kot'], source_lang: 'PL', target_lang: 'EN' });
  });

  test('translates English to Polish and passes the context along', async () => {
    await call(translate, { text: 'cat', targetLang: 'PL', context: 'A pet.' }, learner);

    expect(deeplRequests[0].body).toEqual({
      text: ['cat'],
      source_lang: 'EN',
      target_lang: 'PL',
      context: 'A pet.',
    });
  });

  test('asks for an English infinitive when translating a Polish vocabulary entry', async () => {
    await call(translate, { text: 'jeść', targetLang: 'EN', vocabulary: true }, learner);
    expect(deeplRequests[0].body.custom_instructions).toEqual([
      expect.stringContaining('infinitive'),
    ]);
  });

  test('sends no infinitive instruction for English to Polish vocabulary', async () => {
    await call(translate, { text: 'to eat', targetLang: 'PL', vocabulary: true }, learner);
    expect(deeplRequests[0].body).not.toHaveProperty('custom_instructions');
  });

  test('a DeepL error becomes an internal error', async () => {
    deeplReturns('ignored', 456);
    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }, learner));
    expect(error.code).toBe('internal');
  });

  test('an empty DeepL answer becomes an internal error', async () => {
    deeplReturns(null);
    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }, learner));
    expect(error.code).toBe('internal');
    expect(error.message).toBe('No translation returned.');
  });

  test('a missing DeepL key fails with failed-precondition', async () => {
    vi.stubEnv('DEEPL_API_KEY', '');
    const error = await rejection(call(translate, { text: 'kot', targetLang: 'EN' }, learner));
    expect(error.code).toBe('failed-precondition');
    expect(deeplRequests).toHaveLength(0);
  });
});

describe('caching word translations on built-in cards', () => {
  test('caches a word found in a declension card’s answer, keyed by its cleaned form', async () => {
    db.seed('declensionCards/7', { back: 'Widzę kota.' });
    deeplReturns('cat');

    await call(translate, { text: 'Kota,', targetLang: 'EN', declensionCardId: 7 }, learner);
    expect(db.data('declensionCards/7')).toEqual({
      back: 'Widzę kota.',
      translations: { kota: 'cat' },
    });
  });

  test('caches a phrase found in a sentence’s Polish text', async () => {
    db.seed('sentences/s1', { polish: 'Kot leży na stole.', translations: { kot: 'cat' } });
    deeplReturns('on the table');

    await call(translate, { text: 'na stole', targetLang: 'EN', sentenceId: 's1' }, learner);
    expect(db.data('sentences/s1')?.translations).toEqual({
      kot: 'cat',
      'na stole': 'on the table',
    });
  });

  test('does not cache text that is not part of the card', async () => {
    db.seed('sentences/s1', { polish: 'Mam kotka.' });

    await call(translate, { text: 'kot', targetLang: 'EN', sentenceId: 's1' }, learner);
    expect(db.data('sentences/s1')).toEqual({ polish: 'Mam kotka.' });
  });

  test('does not cache translations into Polish', async () => {
    db.seed('sentences/s1', { polish: 'Kot.' });

    await call(translate, { text: 'kot', targetLang: 'PL', sentenceId: 's1' }, learner);
    expect(db.data('sentences/s1')).toEqual({ polish: 'Kot.' });
  });

  test('ignores a card that does not exist', async () => {
    const result = await call(
      translate,
      { text: 'kot', targetLang: 'EN', declensionCardId: 404, sentenceId: 'missing' },
      learner
    );
    expect(result.translatedText).toBe('the cat');
    expect(db.data('declensionCards/404')).toBeUndefined();
  });

  test('ignores a card id of the wrong type', async () => {
    db.seed('declensionCards/7', { back: 'kot' });

    await call(
      translate,
      { text: 'kot', targetLang: 'EN', declensionCardId: '7' as unknown as number },
      learner
    );
    expect(db.data('declensionCards/7')).toEqual({ back: 'kot' });
  });
});

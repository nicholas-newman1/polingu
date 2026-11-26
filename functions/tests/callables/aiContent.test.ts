/**
 * Admin content tools backed by OpenAI and DeepL: generateExample,
 * generateSentences, discoverCurriculum and processSentence. Access control is
 * covered in adminOnly.test.ts; these cover validation, prompts and parsing the
 * model's output.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { generateExample } from '../../src/callables/generateExample.js';
import { generateSentences } from '../../src/callables/generateSentences.js';
import { discoverCurriculum } from '../../src/callables/discoverCurriculum.js';
import { processSentence } from '../../src/callables/processSentence.js';
import { DEEPL_KEY, OPENAI_KEY, createUser, installFakes, openai } from '../support/sdk.js';
import { call } from '../support/invoke.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

const admin = createUser('admin-1', { admin: true });

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

const userPrompt = (i = 0) =>
  openai.chatRequests[i].messages.find((m) => m.role === 'user')!.content;

describe('generateExample', () => {
  const ask = (data: Record<string, unknown>) => call(generateExample, data as never, admin);

  test.each([
    ['no Polish word', { english: 'cat' }, 'Polish word is required.'],
    ['a non-string Polish word', { polish: 5, english: 'cat' }, 'Polish word is required.'],
    ['no English', { polish: 'kot' }, 'English translation is required.'],
    ['an empty English', { polish: 'kot', english: '' }, 'English translation is required.'],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(ask(data));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('fails with failed-precondition when no OpenAI key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const error = await rejection(ask({ polish: 'kot', english: 'cat' }));
    expect(error.code).toBe('failed-precondition');
  });

  test('returns the generated examples, using the configured key', async () => {
    openai.replyWith(
      '```json\n{"examples":[{"polish":"Mam kota.","english":"I have a cat."},' +
        '{"polish":"Zamek króla.","english":"The king’s castle.","meaning":"castle"}]}\n```'
    );

    expect(await ask({ polish: 'kot', english: 'cat' })).toEqual({
      examples: [
        { polish: 'Mam kota.', english: 'I have a cat.' },
        { polish: 'Zamek króla.', english: 'The king’s castle.', meaning: 'castle' },
      ],
    });
    expect(openai.apiKeys).toEqual([OPENAI_KEY]);
  });

  test('describes the word and only the optional details that were given', async () => {
    openai.replyAlways(() => '{"examples":[{"polish":"a","english":"b"}]}');

    await ask({ polish: 'zamek', english: 'castle; lock', gender: 'masculine' });
    expect(userPrompt()).toContain('"zamek" (castle; lock)');
    expect(userPrompt()).toContain('Gender: masculine');
    expect(userPrompt()).not.toContain('Part of speech');
    expect(userPrompt()).not.toContain('Additional context');

    await ask({ polish: 'iść', english: 'to go', partOfSpeech: 'verb', context: 'motion' });
    expect(userPrompt(1)).toContain('Part of speech: verb');
    expect(userPrompt(1)).toContain('Additional context: motion');
  });

  test.each([
    ['malformed JSON', '{"examples":[{"polish":"a"'],
    ['no examples', '{"examples":[]}'],
    ['examples that are not a list', '{"examples":"Mam kota."}'],
    ['an example without English', '{"examples":[{"polish":"Mam kota."}]}'],
    ['an example without Polish', '{"examples":[{"english":"I have a cat."}]}'],
  ])('rejects model output with %s', async (_case, reply) => {
    openai.replyWith(reply);
    const error = await rejection(ask({ polish: 'kot', english: 'cat' }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to parse AI response.' });
  });
});

describe('generateSentences', () => {
  const ask = (data: Record<string, unknown>) => call(generateSentences, data as never, admin);

  test.each([
    ['no level', { tags: [], count: 3 }, 'Valid CEFR level required.'],
    ['a lowercase level', { level: 'b1', tags: [], count: 3 }, 'Valid CEFR level required.'],
    ['an unknown level', { level: 'C3', tags: [], count: 3 }, 'Valid CEFR level required.'],
    ['tags that are not a list', { level: 'B1', tags: 'food', count: 3 }, 'Tags must be an array.'],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(ask(data));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('fails with failed-precondition when no OpenAI key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const error = await rejection(ask({ level: 'B1', tags: [], count: 1 }));
    expect(error.code).toBe('failed-precondition');
  });

  test('stamps every sentence with the requested level and tags, whatever the model said', async () => {
    openai.replyWith(
      JSON.stringify({
        sentences: [
          { polish: 'Jem chleb.', english: 'I eat bread.', level: 'C2', tags: ['wrong'] },
          { polish: 'Piję wodę.', english: 'I drink water.' },
        ],
      })
    );

    const result = await ask({ level: 'A1', tags: ['food', 'present tense'], count: 2 });
    expect(result.sentences).toEqual([
      {
        polish: 'Jem chleb.',
        english: 'I eat bread.',
        level: 'A1',
        tags: ['food', 'present tense'],
      },
      {
        polish: 'Piję wodę.',
        english: 'I drink water.',
        level: 'A1',
        tags: ['food', 'present tense'],
      },
    ]);
  });

  test('asks for the requested count, level, tags and guidance', async () => {
    openai.replyAlways(() => '{"sentences":[]}');

    await ask({
      level: 'B2',
      tags: ['travel', 'formal'],
      count: 4,
      guidance: 'Use the conditional.',
    });
    expect(userPrompt()).toContain('Generate 4 Polish sentence(s) at CEFR level B2.');
    expect(userPrompt()).toContain('Topics/themes to include: travel, formal');
    expect(userPrompt()).toContain('Additional guidance: Use the conditional.');

    await ask({ level: 'B2', tags: [], count: 4 });
    expect(userPrompt(1)).not.toContain('Topics/themes');
    expect(userPrompt(1)).not.toContain('Additional guidance');
  });

  test('an empty list of sentences is a valid answer', async () => {
    openai.replyWith('{"sentences":[]}');
    expect(await ask({ level: 'A1', tags: [], count: 1 })).toEqual({ sentences: [] });
  });

  test.each([
    ['malformed JSON', 'Here you go: {"sentences": ['],
    ['no sentences list', '{"items":[]}'],
    ['a sentence without English', '{"sentences":[{"polish":"Jem."}]}'],
  ])('rejects model output with %s', async (_case, reply) => {
    openai.replyWith(reply);
    const error = await rejection(ask({ level: 'A1', tags: [], count: 1 }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to parse AI response.' });
  });
});

describe('discoverCurriculum', () => {
  const existingTags = { topics: ['food'], grammar: [], style: ['formal', 'informal'] };
  const ask = (data: Record<string, unknown>) => call(discoverCurriculum, data as never, admin);
  const suggestion = {
    tag: 'motion verbs',
    category: 'grammar',
    priority: 'high',
    explanation: 'Essential.',
    exampleConcepts: ['iść vs chodzić'],
    relevantLevels: ['A2', 'B1'],
  };

  beforeEach(() => openai.replyAlways(() => JSON.stringify({ suggestions: [suggestion] })));

  test('rejects a request without the existing tags', async () => {
    const error = await rejection(ask({ mode: 'grammar' }));
    expect(error).toMatchObject({ code: 'invalid-argument', message: 'Existing tags required.' });
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('fails with failed-precondition when no OpenAI key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const error = await rejection(ask({ mode: 'grammar', existingTags }));
    expect(error.code).toBe('failed-precondition');
  });

  test('returns the model’s suggestions', async () => {
    expect(await ask({ mode: 'topics', existingTags })).toEqual({ suggestions: [suggestion] });
  });

  test('lists the current tags, with "none" for an empty category', async () => {
    await ask({ mode: 'grammar', existingTags });
    expect(userPrompt()).toContain('- Topics: food');
    expect(userPrompt()).toContain('- Grammar: none');
    expect(userPrompt()).toContain('- Style: formal, informal');
  });

  test.each([
    ['grammar', 'What Polish GRAMMAR concepts are missing'],
    ['topics', 'What everyday TOPICS or situations should be added?'],
    ['polish-specific', 'What POLISH-SPECIFIC linguistic features'],
    ['something-else', 'What Polish GRAMMAR concepts are missing'],
    ['freeform', 'What Polish GRAMMAR concepts are missing'],
  ])('the %s mode asks the matching question', async (mode, question) => {
    await ask({ mode, existingTags });
    expect(userPrompt()).toContain(question);
  });

  test('a freeform question is asked as written', async () => {
    await ask({ mode: 'freeform', freeformQuestion: 'What about numerals?', existingTags });
    expect(userPrompt()).toMatch(/^Question: What about numerals\?/);
  });

  test('focuses on a level when one is given', async () => {
    await ask({ mode: 'grammar', level: 'B1', existingTags });
    await ask({ mode: 'grammar', existingTags });
    expect(userPrompt(0)).toContain('Focus on CEFR level: B1');
    expect(userPrompt(1)).toContain('Consider all CEFR levels.');
  });

  test.each([
    ['malformed JSON', '{"suggestions": [{'],
    ['suggestions that are not a list', '{"suggestions":{"tag":"x"}}'],
  ])('rejects model output with %s', async (_case, reply) => {
    openai.replyWith(reply);
    const error = await rejection(ask({ mode: 'grammar', existingTags }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to parse AI response.' });
  });
});

describe('processSentence', () => {
  let deeplBodies: Array<Record<string, unknown>>;
  let deeplAuth: string[];

  function deeplReturns(body: unknown, status = 200) {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      deeplBodies.push(JSON.parse(init.body as string));
      deeplAuth.push((init.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify(body), { status });
    });
  }

  beforeEach(() => {
    deeplBodies = [];
    deeplAuth = [];
    deeplReturns({ translations: [{ text: 'I have a cat.' }] });
  });

  const ask = (data: Record<string, unknown>) => call(processSentence, data as never, admin);

  test.each([
    ['no text', { sourceLang: 'PL' }, 'Valid text required (max 500 chars).'],
    [
      'text over 500 characters',
      { text: 'a'.repeat(501), sourceLang: 'PL' },
      'Valid text required (max 500 chars).',
    ],
    [
      'an unsupported language',
      { text: 'Hallo', sourceLang: 'DE' },
      'Source language must be EN or PL.',
    ],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(ask(data));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(deeplBodies).toHaveLength(0);
  });

  test.each(['DEEPL_API_KEY', 'OPENAI_API_KEY'])(
    'fails with failed-precondition when %s is missing',
    async (key) => {
      vi.stubEnv(key, '');
      const error = await rejection(ask({ text: 'Mam kota.', sourceLang: 'PL' }));
      expect(error).toMatchObject({
        code: 'failed-precondition',
        message: 'Services not configured.',
      });
      expect(deeplBodies).toHaveLength(0);
    }
  );

  test('a Polish sentence is translated to English and levelled', async () => {
    openai.replyWith('A1');

    expect(await ask({ text: 'Mam kota.', sourceLang: 'PL' })).toEqual({
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
    });
    expect(deeplBodies).toEqual([{ text: ['Mam kota.'], source_lang: 'PL', target_lang: 'EN' }]);
    expect(deeplAuth).toEqual([`DeepL-Auth-Key ${DEEPL_KEY}`]);
  });

  test('an English sentence is translated to Polish, and the Polish is what gets levelled', async () => {
    deeplReturns({ translations: [{ text: 'Gdybym miał czas, poszedłbym.' }] });
    openai.replyWith('B2');

    expect(await ask({ text: 'If I had time, I would go.', sourceLang: 'EN' })).toEqual({
      polish: 'Gdybym miał czas, poszedłbym.',
      english: 'If I had time, I would go.',
      level: 'B2',
    });
    expect(deeplBodies[0]).toMatchObject({ source_lang: 'EN', target_lang: 'PL' });
    expect(userPrompt()).toBe('Gdybym miał czas, poszedłbym.');
  });

  test('defaults to B1 when the model gives no usable level', async () => {
    openai.replyWith('It is probably intermediate.');
    expect((await ask({ text: 'Mam kota.', sourceLang: 'PL' })).level).toBe('B1');
  });

  test('a DeepL error becomes an internal error', async () => {
    deeplReturns({ message: 'Quota exceeded' }, 456);
    const error = await rejection(ask({ text: 'Mam kota.', sourceLang: 'PL' }));
    expect(error).toMatchObject({ code: 'internal', message: 'Translation failed.' });
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('an empty DeepL answer becomes an internal error', async () => {
    deeplReturns({ translations: [] });
    const error = await rejection(ask({ text: 'Mam kota.', sourceLang: 'PL' }));
    expect(error).toMatchObject({ code: 'internal', message: 'No translation returned.' });
  });
});

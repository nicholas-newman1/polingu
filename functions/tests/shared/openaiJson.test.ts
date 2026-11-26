import { describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { requestJsonCompletion } from '../../src/shared/openaiJson.js';
import { CHAT_MODEL_PARAMS, createOpenAI } from '../../src/shared/openai.js';
import { installFakes, openai } from '../support/sdk.js';

vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

type Answer = { items: string[] };

const params = {
  ...CHAT_MODEL_PARAMS,
  messages: [{ role: 'user' as const, content: 'List things as JSON.' }],
};

const requireItems = (parsed: Answer) => {
  if (!Array.isArray(parsed.items)) throw new Error('bad shape');
};

async function complete(validate: (parsed: Answer) => void = requireItems) {
  return requestJsonCompletion<Answer>(await createOpenAI('key'), params, validate);
}

async function failure(validate?: (parsed: Answer) => void) {
  const error = await complete(validate).then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(HttpsError);
  return error as HttpsError;
}

describe('requestJsonCompletion', () => {
  test('parses a plain JSON answer', async () => {
    openai.replyWith('{"items":["a","b"]}');
    expect(await complete()).toEqual({ items: ['a', 'b'] });
  });

  test('parses JSON wrapped in a markdown code fence', async () => {
    openai.replyWith('```json\n{"items":["a"]}\n```');
    expect(await complete()).toEqual({ items: ['a'] });
  });

  test('sends the given request parameters to the model', async () => {
    openai.replyWith('{"items":[]}');
    await complete();
    expect(openai.chatRequests).toEqual([params]);
  });

  test('returns the value as normalised by the validator', async () => {
    openai.replyWith('{"items":["a"]}');
    const result = await complete((parsed) => {
      parsed.items = parsed.items.map((item) => item.toUpperCase());
    });
    expect(result).toEqual({ items: ['A'] });
  });

  test.each([
    ['truncated JSON', '{"items":["a",'],
    ['prose instead of JSON', 'Sure! Here are some items: a, b.'],
    ['JSON followed by commentary', '{"items":[]}\nHope this helps!'],
  ])('rejects %s with an internal error', async (_case, reply) => {
    openai.replyWith(reply);
    const error = await failure();
    expect(error.code).toBe('internal');
    expect(error.message).toBe('Failed to parse AI response.');
  });

  test('rejects valid JSON of the wrong shape', async () => {
    openai.replyWith('{"things":[]}');
    const error = await failure();
    expect(error.code).toBe('internal');
    expect(error.message).toBe('Failed to parse AI response.');
  });

  test('rejects JSON null without crashing the validator', async () => {
    openai.replyWith('null');
    const error = await failure((parsed) => {
      if (!parsed?.items) throw new Error('bad shape');
    });
    expect(error.code).toBe('internal');
  });

  test.each([
    ['empty', ''],
    ['missing', null],
  ])('rejects an %s answer', async (_case, reply) => {
    openai.replyWith(reply);
    const error = await failure();
    expect(error.code).toBe('internal');
    expect(error.message).toBe('No response from AI.');
  });

  test('lets an API failure propagate', async () => {
    openai.replyWith(new Error('429 Too Many Requests'));
    await expect(complete()).rejects.toThrow('429 Too Many Requests');
  });
});

describe('createOpenAI', () => {
  test('creates a client with the given API key', async () => {
    await createOpenAI('sk-test');
    expect(openai.apiKeys).toEqual(['sk-test']);
  });
});

import { describe, expect, test, vi } from 'vitest';
import { assessSentenceCEFR, isCEFRLevel, requestCEFRLevel } from '../../src/shared/cefr.js';
import { createOpenAI } from '../../src/shared/openai.js';
import { installFakes, openai } from '../support/sdk.js';

vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

describe('isCEFRLevel', () => {
  test.each(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])('accepts %s', (level) => {
    expect(isCEFRLevel(level)).toBe(true);
  });

  test.each(['a1', 'B3', 'A', '', ' B1', null, undefined, 1, ['B1']])('rejects %j', (value) => {
    expect(isCEFRLevel(value)).toBe(false);
  });
});

describe('requestCEFRLevel', () => {
  test('asks the model about the sentence and returns its level', async () => {
    openai.replyWith('B2');
    const level = await requestCEFRLevel(
      await createOpenAI('key'),
      'Gdybym miał czas, pojechałbym.'
    );

    expect(level).toBe('B2');
    const { messages } = openai.chatRequests[0];
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Gdybym miał czas, pojechałbym.' });
  });

  test('accepts a lowercase answer with surrounding whitespace', async () => {
    openai.replyWith('  a2\n');
    expect(await requestCEFRLevel(await createOpenAI('key'), 'Mam psa.')).toBe('A2');
  });

  test.each([
    ['an explanation', 'Level: B1'],
    ['trailing punctuation', 'B1.'],
    ['an unknown level', 'D1'],
    ['an empty answer', ''],
    ['no content', null],
  ])('returns null for %s', async (_case, reply) => {
    openai.replyWith(reply);
    expect(await requestCEFRLevel(await createOpenAI('key'), 'Mam psa.')).toBeNull();
  });

  test('lets an API failure propagate', async () => {
    openai.replyWith(new Error('network down'));
    await expect(requestCEFRLevel(await createOpenAI('key'), 'Mam psa.')).rejects.toThrow(
      'network down'
    );
  });
});

describe('assessSentenceCEFR', () => {
  test('uses the given API key and returns the level', async () => {
    openai.replyWith('C1');
    expect(await assessSentenceCEFR('Zdanie.', 'sk-123')).toBe('C1');
    expect(openai.apiKeys).toEqual(['sk-123']);
  });

  test('returns null instead of throwing when the API fails', async () => {
    openai.replyWith(new Error('500'));
    expect(await assessSentenceCEFR('Zdanie.', 'sk-123')).toBeNull();
  });
});

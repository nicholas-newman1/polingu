import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  handleTooltipTranslationError,
  RateLimitDailyError,
  RateLimitMinuteError,
  translate,
} from '../../src/lib/translate';
import { resetCallables, serveCallable } from './support/fakeFunctions';
import { functionsError, RESET_TIME } from './support/translateServer';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

beforeEach(() => {
  resetCallables();
});

const answer = { translatedText: 'cat', charsUsedToday: 42, resetTime: RESET_TIME };

describe('translate', () => {
  test('sends the text and target language and returns the translation with usage', async () => {
    const server = serveCallable('translate', () => answer);

    const result = await translate('kot', 'EN', { context: 'Kot śpi.', sentenceId: 's-1' });

    expect(server).toHaveBeenCalledWith({
      text: 'kot',
      targetLang: 'EN',
      context: 'Kot śpi.',
      sentenceId: 's-1',
    });
    expect(result).toEqual({ translatedText: 'cat', charsUsedToday: 42, resetTime: RESET_TIME });
  });

  test('leaves out options that are undefined, which Firebase would otherwise send as null', async () => {
    const server = serveCallable('translate', () => answer);

    await translate('kot', 'EN', {
      context: undefined,
      declensionCardId: undefined,
      sentenceId: undefined,
      vocabulary: false,
    });

    const sent = server.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).toEqual({ text: 'kot', targetLang: 'EN', vocabulary: false });
    expect(Object.keys(sent)).not.toContain('context');
    expect(Object.keys(sent)).not.toContain('declensionCardId');
    expect(Object.keys(sent)).not.toContain('sentenceId');
  });

  test('a context over the 1000 characters the server accepts is cut to the stretch around the text', async () => {
    const server = serveCallable('translate', () => answer);
    const filler = 'Ala ma kota. '.repeat(100);
    const context = `${filler}Pies śpi pod stołem. ${filler}`;

    await translate('pies', 'EN', { context });

    const sent = (server.mock.calls[0][0] as { context: string }).context;
    expect(sent).toHaveLength(1000);
    expect(sent).toContain('Pies śpi pod stołem.');
    expect(context).toContain(sent);
  });

  test('a per-minute rate limit becomes a RateLimitMinuteError', async () => {
    serveCallable('translate', () => {
      throw functionsError('resource-exhausted', 'RATE_LIMIT_MINUTE');
    });

    const error = await translate('kot', 'EN').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitMinuteError);
    expect((error as Error).message).toBe('Too many requests. Please wait a moment.');
  });

  test('a daily limit becomes a RateLimitDailyError carrying the reset time', async () => {
    serveCallable('translate', () => {
      throw functionsError('resource-exhausted', `RATE_LIMIT_DAILY:${RESET_TIME}`);
    });

    const error = await translate('kot', 'EN').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitDailyError);
    expect((error as RateLimitDailyError).resetTime).toBe(RESET_TIME);
    expect((error as Error).message).toBe("You've hit your translation limit for the day.");
  });

  test('a daily limit message is recognised even without the resource-exhausted code', async () => {
    serveCallable('translate', () => {
      throw new Error('RATE_LIMIT_DAILY:2026-12-01T00:00:00.000Z');
    });

    const error = await translate('kot', 'EN').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitDailyError);
    expect((error as RateLimitDailyError).resetTime).toBe('2026-12-01T00:00:00.000Z');
  });

  test('any other resource-exhausted error is treated as the per-minute limit', async () => {
    serveCallable('translate', () => {
      throw functionsError('resource-exhausted', 'quota exceeded');
    });

    await expect(translate('kot', 'EN')).rejects.toBeInstanceOf(RateLimitMinuteError);
  });

  test('text over the length limit is reported as too long', async () => {
    serveCallable('translate', () => {
      throw functionsError('invalid-argument', 'TEXT_TOO_LONG');
    });

    const error = await translate('x'.repeat(501), 'EN').catch((e: unknown) => e);

    expect((error as Error).name).toBe('TextTooLongError');
    expect((error as Error).message).toBe('Text exceeds maximum length of 500 characters.');
  });

  test('other server errors reach the caller unchanged', async () => {
    const failure = functionsError('internal', 'Translation failed. Please try again.');
    serveCallable('translate', () => {
      throw failure;
    });

    await expect(translate('kot', 'EN')).rejects.toBe(failure);
  });
});

describe('handleTooltipTranslationError', () => {
  const handlers = () => ({
    setError: vi.fn<(message: string) => void>(),
    showSnackbar: vi.fn<(message: string, severity: 'warning' | 'error') => void>(),
    onDailyLimit: vi.fn<(resetTime: string) => void>(),
  });

  test('the per-minute limit shows "Too many requests" in the tooltip and a warning', () => {
    const h = handlers();

    handleTooltipTranslationError(new RateLimitMinuteError(), h);

    expect(h.setError).toHaveBeenCalledWith('Too many requests');
    expect(h.showSnackbar).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment.',
      'warning'
    );
    expect(h.onDailyLimit).not.toHaveBeenCalled();
  });

  test('the daily limit is handed on with its reset time, without an inline error', () => {
    const h = handlers();

    handleTooltipTranslationError(new RateLimitDailyError(RESET_TIME), h);

    expect(h.onDailyLimit).toHaveBeenCalledWith(RESET_TIME);
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.showSnackbar).not.toHaveBeenCalled();
  });

  test('any other failure shows "Translation failed" and an error snackbar', () => {
    const h = handlers();

    handleTooltipTranslationError(new Error('offline'), h);

    expect(h.setError).toHaveBeenCalledWith('Translation failed');
    expect(h.showSnackbar).toHaveBeenCalledWith('Translation failed. Please try again.', 'error');
    expect(h.onDailyLimit).not.toHaveBeenCalled();
  });
});

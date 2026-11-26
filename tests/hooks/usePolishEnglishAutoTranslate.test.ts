import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  usePolishEnglishAutoTranslate,
  usePolishEnglishFormAutoTranslate,
} from '../../src/hooks/usePolishEnglishAutoTranslate';
import { translate, type TranslationResult } from '../../src/lib/translate';
import { deferred } from './support/deferred';

// translate() calls a Cloud Function.
vi.mock('../../src/lib/translate', () => ({ translate: vi.fn() }));

const DEBOUNCE_MS = 500;
const result = (translatedText: string): TranslationResult => ({
  translatedText,
  charsUsedToday: 0,
  resetTime: '',
});

/** Answers every translation at once, as "EN(text)" or "PL(text)". */
const answerImmediately = () =>
  vi.mocked(translate).mockImplementation(async (text, lang) => result(`${lang}(${text})`));

/** Holds every translation until the test answers it. */
function answerByHand() {
  const calls: Array<ReturnType<typeof deferred<TranslationResult>>> = [];
  vi.mocked(translate).mockImplementation(() => {
    const call = deferred<TranslationResult>();
    calls.push(call);
    return call.promise;
  });
  return {
    answer: (index: number, text: string) => act(async () => calls[index].resolve(result(text))),
    fail: (index: number) => act(async () => calls[index].reject(new Error('rate limited'))),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  answerImmediately();
});

/** A form with Polish/English rows; typing updates a row, then notifies the hook. */
function renderPair({ vocabulary }: { vocabulary?: boolean } = {}) {
  const rows = new Map<number, { polish: string; english: string }>();
  const row = (key: number) => {
    if (!rows.has(key)) rows.set(key, { polish: '', english: '' });
    return rows.get(key)!;
  };
  const hook = renderHook(() =>
    usePolishEnglishAutoTranslate<number>({
      vocabulary,
      getPolish: (key) => row(key).polish,
      getEnglish: (key) => row(key).english,
      onPolishTranslated: (key, polish) => void (row(key).polish = polish),
      onEnglishTranslated: (key, english) => void (row(key).english = english),
      debounceMs: DEBOUNCE_MS,
    })
  );
  const pair = () => hook.result.current;
  return {
    pair,
    row,
    typePolish: (text: string, key = 0) => {
      row(key).polish = text;
      act(() => pair().handlePolishChange(key, text));
    },
    typeEnglish: (text: string, key = 0) => {
      row(key).english = text;
      act(() => pair().handleEnglishChange(key, text));
    },
    /** Lets the debounce fire and any immediate answer land. */
    pause: (ms = DEBOUNCE_MS) => act(async () => vi.advanceTimersByTime(ms)),
  };
}

describe('usePolishEnglishAutoTranslate', () => {
  test('typing Polish fills an empty English field once typing pauses', async () => {
    const h = renderPair({ vocabulary: true });
    h.typePolish('kot');
    await h.pause(DEBOUNCE_MS - 1);
    expect(translate).not.toHaveBeenCalled();

    await h.pause(1);
    expect(translate).toHaveBeenCalledExactlyOnceWith('kot', 'EN', { vocabulary: true });
    expect(h.row(0).english).toBe('EN(kot)');
  });

  test('English typed into an empty Polish field is translated into Polish', async () => {
    const h = renderPair({ vocabulary: true });
    h.typeEnglish('  a cat ');
    await h.pause();
    expect(translate).toHaveBeenCalledExactlyOnceWith('a cat', 'PL', { vocabulary: undefined });
    expect(h.row(0).polish).toBe('PL(a cat)');
  });

  test('each keystroke restarts the wait, so only the final text is translated', async () => {
    const h = renderPair();
    for (const text of ['k', 'ko', 'kot']) {
      h.typePolish(text);
      await h.pause(DEBOUNCE_MS - 100);
    }
    await h.pause(100);
    expect(vi.mocked(translate).mock.calls.map(([text]) => text)).toEqual(['kot']);
  });

  test('never overwrites English the learner wrote', async () => {
    const h = renderPair();
    h.row(0).english = 'my cat';
    h.typePolish('kot');
    await h.pause();
    expect(translate).not.toHaveBeenCalled();
    expect(h.row(0).english).toBe('my cat');
  });

  test('keeps correcting its own translation while the Polish is being extended', async () => {
    const h = renderPair();
    h.typePolish('duży');
    await h.pause();
    h.typePolish('duży kot');
    await h.pause();
    expect(h.row(0).english).toBe('EN(duży kot)');
  });

  test('leaves its translation alone once the learner edits the English', async () => {
    const h = renderPair();
    h.typePolish('duży');
    await h.pause();
    h.typeEnglish('large');
    h.typePolish('duży kot');
    await h.pause();
    expect(h.row(0).english).toBe('large');
    expect(translate).toHaveBeenCalledTimes(1);
  });

  test('a reworked rather than extended Polish text keeps the earlier translation', async () => {
    const h = renderPair();
    h.typePolish('duży kot');
    await h.pause();
    h.typePolish('mały kot');
    await h.pause();
    expect(h.row(0).english).toBe('EN(duży kot)');
  });

  test('after leaving the Polish field its translation is settled', async () => {
    const h = renderPair();
    h.typePolish('duży');
    await h.pause();
    act(() => h.pair().handlePolishBlur(0));
    h.typePolish('duży kot');
    await h.pause();
    expect(h.row(0).english).toBe('EN(duży)');
  });

  test('clearing the Polish lets the next text replace the old translation', async () => {
    const h = renderPair();
    h.typePolish('kot');
    await h.pause();
    h.typePolish('');
    await h.pause();
    h.typePolish('pies');
    await h.pause();
    expect(h.row(0).english).toBe('EN(pies)');
  });

  test('a slow translation of older text is dropped once newer text was typed', async () => {
    const requests = answerByHand();
    const h = renderPair();
    h.typePolish('kot');
    await h.pause();
    h.typePolish('kot i pies');
    await h.pause();

    await requests.answer(1, 'cat and dog');
    await requests.answer(0, 'cat');
    expect(h.row(0).english).toBe('cat and dog');
  });

  test('a translation arriving after the learner typed English is dropped', async () => {
    const requests = answerByHand();
    const h = renderPair();
    h.typePolish('kot');
    await h.pause();
    expect(h.pair().isTranslatingEnglish(0)).toBe(true);

    h.typeEnglish('kitty');
    await requests.answer(0, 'cat');
    expect(h.row(0).english).toBe('kitty');
  });

  test('a translation that finishes after leaving the field still fills it, but is then settled', async () => {
    const requests = answerByHand();
    const h = renderPair();
    h.typePolish('duży');
    await h.pause();
    act(() => h.pair().handlePolishBlur(0));
    await requests.answer(0, 'big');
    expect(h.row(0).english).toBe('big');

    h.typePolish('duży kot');
    await h.pause();
    expect(translate).toHaveBeenCalledTimes(1);
    expect(h.row(0).english).toBe('big');
  });

  test('cancelling drops both waiting and in-flight translations', async () => {
    const requests = answerByHand();
    const h = renderPair();
    h.typePolish('kot', 0);
    await h.pause();
    h.typePolish('pies', 1);
    act(() => h.pair().cancelAll());

    await h.pause();
    await requests.answer(0, 'cat');
    expect(translate).toHaveBeenCalledTimes(1);
    expect(h.row(0).english).toBe('');
    expect(h.row(1).english).toBe('');
    expect(h.pair().isTranslatingEnglish(0)).toBe(false);
  });

  test('rows translate independently of each other', async () => {
    const h = renderPair();
    h.typePolish('kot', 0);
    await h.pause(200);
    h.typePolish('pies', 1);
    await h.pause();
    expect(h.row(0).english).toBe('EN(kot)');
    expect(h.row(1).english).toBe('EN(pies)');
  });

  test('shows progress while translating and clears it when a translation fails', async () => {
    const requests = answerByHand();
    const h = renderPair();
    h.typePolish('kot');
    await h.pause();
    expect(h.pair().isTranslatingEnglish(0)).toBe(true);
    expect(h.pair().isTranslatingPolish(0)).toBe(false);

    await requests.fail(0);
    expect(h.pair().isTranslatingEnglish(0)).toBe(false);
    expect(h.row(0).english).toBe('');
  });
});

describe('usePolishEnglishFormAutoTranslate', () => {
  test('writes the translation into the form field, validating it', async () => {
    const values: Record<string, string> = { word: 'kot', meaning: '' };
    const setValue = vi.fn((name: string, value: string) => void (values[name] = value));
    const form = { getValues: (name: string) => values[name], setValue };
    const { result } = renderHook(() =>
      usePolishEnglishFormAutoTranslate(form as never, {
        fieldNames: { polish: 'word', english: 'meaning' },
      })
    );

    act(() => result.current.handlePolishChange('kot'));
    await act(async () => vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(setValue).toHaveBeenCalledExactlyOnceWith('meaning', 'EN(kot)', {
      shouldValidate: true,
    });
  });
});

/**
 * The `translate` Cloud Function, faked on top of fakeFunctions.ts.
 *
 * By default every request is answered at once: from `dictionary` when the text is
 * listed there, otherwise as "<text> (EN)" / "<text> (PL)". Call `hold()` to keep
 * requests pending until the test answers them, in any order, with `answer()`/`fail()`.
 */
import { act } from '@testing-library/react';
import { deferred } from '../../hooks/support/deferred';
import { serveCallable } from './fakeFunctions';

export interface TranslateRequest {
  text: string;
  targetLang: 'EN' | 'PL';
  context?: string;
  declensionCardId?: number;
  sentenceId?: string;
  vocabulary?: boolean;
}

interface TranslateResponse {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

export const RESET_TIME = '2026-11-27T00:00:00.000Z';

/** An error as the Firebase SDK raises it for an HttpsError thrown by a callable. */
export const functionsError = (code: string, message: string) =>
  Object.assign(new Error(message), { code: `functions/${code}` });

export const minuteLimitError = () => functionsError('resource-exhausted', 'RATE_LIMIT_MINUTE');
export const dailyLimitError = (resetTime = RESET_TIME) =>
  functionsError('resource-exhausted', `RATE_LIMIT_DAILY:${resetTime}`);

export const autoTranslation = (text: string, targetLang: 'EN' | 'PL') => `${text} (${targetLang})`;

export function fakeTranslateServer(dictionary: Record<string, string> = {}) {
  let holding = false;
  let failure: unknown = null;
  let charsUsedToday = 0;
  const pending: Array<{
    request: TranslateRequest;
    reply: ReturnType<typeof deferred<TranslateResponse>>;
  }> = [];

  const respond = (request: TranslateRequest, translatedText: string): TranslateResponse => {
    charsUsedToday += request.text.length;
    return { translatedText, charsUsedToday, resetTime: RESET_TIME };
  };

  const fn = serveCallable<TranslateRequest, TranslateResponse>('translate', (request) => {
    // The real function validates the request before doing anything else
    // (validateRequest in functions/src/callables/translate.ts).
    if (!request.text) throw functionsError('invalid-argument', 'Text is required.');
    if (request.text.length > 500) throw functionsError('invalid-argument', 'TEXT_TOO_LONG');
    if (request.context && request.context.length > 1000) {
      throw functionsError('invalid-argument', 'Context too long.');
    }
    if (failure) throw failure;
    if (holding) {
      const reply = deferred<TranslateResponse>();
      pending.push({ request, reply });
      return reply.promise;
    }
    return respond(
      request,
      dictionary[request.text] ?? autoTranslation(request.text, request.targetLang)
    );
  });

  const takePending = (text: string) => {
    const index = pending.findIndex((p) => p.request.text === text);
    if (index === -1) throw new Error(`No pending translation for "${text}"`);
    return pending.splice(index, 1)[0];
  };

  return {
    /** Every request payload received, in order. */
    requests: () => fn.mock.calls.map(([request]) => request as TranslateRequest),
    /** The text of every request received, in order. */
    texts: () => fn.mock.calls.map(([request]) => (request as TranslateRequest).text),
    /** Keeps every later request pending until answered. */
    hold() {
      holding = true;
    },
    /** Rejects every later request with `error`. */
    failWith(error: unknown) {
      failure = error;
    },
    /** Sets the usage the next answers report (it then grows by each request's length). */
    setCharsUsedToday(chars: number) {
      charsUsedToday = chars;
    },
    /** Answers the oldest pending request for `text`. */
    answer: (text: string, translatedText: string) =>
      act(async () => {
        const { request, reply } = takePending(text);
        reply.resolve(respond(request, translatedText));
      }),
    /** Fails the oldest pending request for `text`. */
    fail: (text: string, error: unknown) =>
      act(async () => {
        takePending(text).reply.reject(error);
      }),
  };
}

export type FakeTranslateServer = ReturnType<typeof fakeTranslateServer>;

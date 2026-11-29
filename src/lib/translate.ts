import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export interface TranslationOptions {
  context?: string;
  declensionCardId?: number;
  sentenceId?: string;
  vocabulary?: boolean;
}

interface TranslateRequest extends TranslationOptions {
  text: string;
  targetLang: 'EN' | 'PL';
}

export interface TranslationResult {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

class TextTooLongError extends Error {
  constructor() {
    super('Text exceeds maximum length of 500 characters.');
    this.name = 'TextTooLongError';
  }
}

export class RateLimitMinuteError extends Error {
  constructor() {
    super('Too many requests. Please wait a moment.');
    this.name = 'RateLimitMinuteError';
  }
}

export class RateLimitDailyError extends Error {
  resetTime: string;

  constructor(resetTime: string) {
    super("You've hit your translation limit for the day.");
    this.name = 'RateLimitDailyError';
    this.resetTime = resetTime;
  }
}

interface TooltipErrorHandlers {
  setError: (message: string) => void;
  showSnackbar: (message: string, severity: 'warning' | 'error') => void;
  onDailyLimit: (resetTime: string) => void;
}

/** Shared error handling for the inline word/phrase translation tooltips. */
export function handleTooltipTranslationError(err: unknown, handlers: TooltipErrorHandlers) {
  if (err instanceof RateLimitMinuteError) {
    handlers.setError('Too many requests');
    handlers.showSnackbar('Too many requests. Please wait a moment.', 'warning');
  } else if (err instanceof RateLimitDailyError) {
    handlers.onDailyLimit(err.resetTime);
  } else {
    handlers.setError('Translation failed');
    handlers.showSnackbar('Translation failed. Please try again.', 'error');
  }
}

/**
 * The key word and phrase translations are cached under. Must match cleanTextForCacheKey
 * in functions/src/shared/rateLimits.ts, which stores translations on sentences and
 * declension cards under this key.
 */
export function translationCacheKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ąćęłńóśźż ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * A tapped word as it is sent for translation: lowercased, without the punctuation around
 * it. Empty for a token of punctuation alone.
 */
export function wordToTranslate(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** The translate function rejects a longer context (validateRequest in functions/src/callables/translate.ts). */
const MAX_CONTEXT_LENGTH = 1000;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cuts a context over the server's limit down to the stretch around `text`. */
function fitContext(context: string | undefined, text: string): string | undefined {
  if (!context || context.length <= MAX_CONTEXT_LENGTH) return context;
  const pattern = text.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  const match = new RegExp(pattern, 'iu').exec(context);
  const middle = match ? match.index + match[0].length / 2 : 0;
  const start = Math.min(
    Math.max(0, Math.round(middle - MAX_CONTEXT_LENGTH / 2)),
    context.length - MAX_CONTEXT_LENGTH
  );
  return context.slice(start, start + MAX_CONTEXT_LENGTH);
}

const translateFn = httpsCallable<TranslateRequest, TranslationResult>(functions, 'translate');

export async function translate(
  text: string,
  targetLang: 'EN' | 'PL',
  options: TranslationOptions = {}
): Promise<TranslationResult> {
  try {
    // Firebase encodes undefined values as null; optional fields must be omitted.
    const definedOptions = Object.fromEntries(
      Object.entries({ ...options, context: fitContext(options.context, text) }).filter(
        ([, value]) => value !== undefined
      )
    );
    const result = await translateFn({ ...definedOptions, text, targetLang });
    return {
      translatedText: result.data.translatedText,
      charsUsedToday: result.data.charsUsedToday,
      resetTime: result.data.resetTime,
    };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError.message === 'TEXT_TOO_LONG') {
      throw new TextTooLongError();
    }

    if (firebaseError.message === 'RATE_LIMIT_MINUTE') {
      throw new RateLimitMinuteError();
    }

    if (firebaseError.message?.startsWith('RATE_LIMIT_DAILY:')) {
      const resetTime = firebaseError.message.substring('RATE_LIMIT_DAILY:'.length);
      throw new RateLimitDailyError(resetTime);
    }

    if (firebaseError.code === 'functions/resource-exhausted') {
      throw new RateLimitMinuteError();
    }

    throw error;
  }
}

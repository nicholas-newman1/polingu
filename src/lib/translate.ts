import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

interface TranslateRequest {
  text: string;
  targetLang: 'EN' | 'PL';
  context?: string;
}

interface TranslateResponse {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

export class TextTooLongError extends Error {
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

export interface TranslationResult {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

const translateFn = httpsCallable<TranslateRequest, TranslateResponse>(
  functions,
  'translate'
);

export async function translate(
  text: string,
  targetLang: 'EN' | 'PL',
  context?: string
): Promise<TranslationResult> {
  try {
    const result = await translateFn({ text, targetLang, context });
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
    
    throw error;
  }
}

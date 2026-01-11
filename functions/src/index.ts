import { setGlobalOptions } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
const db = getFirestore();

const deeplApiKey = defineSecret('DEEPL_API_KEY');

setGlobalOptions({ maxInstances: 10 });

const MAX_TEXT_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_CHARS_PER_DAY = 1500;

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

interface RateLimitDoc {
  dailyCharsUsed: number;
  dailyCharsDate: string;
  recentRequests: number[];
}

function getUTCDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getNextMidnightUTC(): string {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  return tomorrow.toISOString();
}

async function getRateLimitDoc(userId: string): Promise<RateLimitDoc> {
  const docRef = db.collection('userRateLimits').doc(userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return {
      dailyCharsUsed: 0,
      dailyCharsDate: getUTCDateString(),
      recentRequests: [],
    };
  }

  const data = doc.data() as RateLimitDoc;
  const today = getUTCDateString();

  if (data.dailyCharsDate !== today) {
    return {
      dailyCharsUsed: 0,
      dailyCharsDate: today,
      recentRequests: data.recentRequests || [],
    };
  }

  return {
    dailyCharsUsed: data.dailyCharsUsed || 0,
    dailyCharsDate: data.dailyCharsDate,
    recentRequests: data.recentRequests || [],
  };
}

function checkMinuteRateLimit(recentRequests: number[]): boolean {
  const oneMinuteAgo = Date.now() - 60000;
  const recentCount = recentRequests.filter((ts) => ts > oneMinuteAgo).length;
  return recentCount < MAX_REQUESTS_PER_MINUTE;
}

function filterRecentRequests(recentRequests: number[]): number[] {
  const oneMinuteAgo = Date.now() - 60000;
  return recentRequests.filter((ts) => ts > oneMinuteAgo);
}

function hashContext(context: string): string {
  let hash = 0;
  for (let i = 0; i < context.length; i++) {
    const char = context.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getCacheKey(word: string, context?: string): string {
  if (!context) return word;
  return `${word}__${hashContext(context)}`;
}

export const translate = onCall<TranslateRequest, Promise<TranslateResponse>>(
  { secrets: [deeplApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be signed in to use the translator.'
      );
    }

    const userId = request.auth.uid;
    const { text, targetLang, context } = request.data;

    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', 'Text is required.');
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new HttpsError('invalid-argument', 'TEXT_TOO_LONG');
    }

    if (targetLang !== 'EN' && targetLang !== 'PL') {
      throw new HttpsError(
        'invalid-argument',
        'Target language must be EN or PL.'
      );
    }

    if (context && context.length > 1000) {
      throw new HttpsError('invalid-argument', 'Context too long.');
    }

    const rateLimitData = await getRateLimitDoc(userId);
    const resetTime = getNextMidnightUTC();

    if (!checkMinuteRateLimit(rateLimitData.recentRequests)) {
      throw new HttpsError('resource-exhausted', 'RATE_LIMIT_MINUTE');
    }

    if (rateLimitData.dailyCharsUsed + text.length > MAX_CHARS_PER_DAY) {
      throw new HttpsError(
        'resource-exhausted',
        `RATE_LIMIT_DAILY:${resetTime}`
      );
    }

    const apiKey = deeplApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'Translation service is not configured.'
      );
    }

    const sourceLang = targetLang === 'EN' ? 'PL' : 'EN';

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang,
        target_lang: targetLang,
        ...(context && { context }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepL API error:', response.status, errorText);
      throw new HttpsError('internal', 'Translation failed. Please try again.');
    }

    const data = await response.json();
    const translatedText = data.translations?.[0]?.text;

    if (!translatedText) {
      throw new HttpsError('internal', 'No translation returned.');
    }

    const newCharsUsed = rateLimitData.dailyCharsUsed + text.length;
    const filteredRequests = filterRecentRequests(rateLimitData.recentRequests);

    await db
      .collection('userRateLimits')
      .doc(userId)
      .set({
        dailyCharsUsed: newCharsUsed,
        dailyCharsDate: getUTCDateString(),
        recentRequests: [...filteredRequests, Date.now()],
      });

    const isSingleWord = !text.includes(' ') && text.length <= 50;
    if (isSingleWord && targetLang === 'EN') {
      const cacheKey = getCacheKey(text.toLowerCase(), context);
      await db.collection('wordTranslations').doc(cacheKey).set({
        translation: translatedText,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      translatedText,
      charsUsedToday: newCharsUsed,
      resetTime,
    };
  }
);

import { onCall, HttpsError } from 'firebase-functions/https';
import { db } from '../shared/firebase.js';
import { deeplApiKey } from '../shared/secrets.js';
import { assertNotKilled } from '../shared/killSwitch.js';
import {
  cacheKeyAppearsInSource,
  cleanTextForCacheKey,
  getNextMidnightUTC,
  reserveTranslationBudget,
} from '../shared/rateLimits.js';

const MAX_TEXT_LENGTH = 500;

interface TranslateRequest {
  text: string;
  targetLang: 'EN' | 'PL';
  context?: string;
  declensionCardId?: number;
  sentenceId?: string;
}

interface TranslateResponse {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

export const translate = onCall<TranslateRequest, Promise<TranslateResponse>>(
  { secrets: [deeplApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use the translator.');
    }

    const userId = request.auth.uid;
    const { text, targetLang, context, declensionCardId, sentenceId } = request.data;

    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', 'Text is required.');
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new HttpsError('invalid-argument', 'TEXT_TOO_LONG');
    }

    if (targetLang !== 'EN' && targetLang !== 'PL') {
      throw new HttpsError('invalid-argument', 'Target language must be EN or PL.');
    }

    if (context && context.length > 1000) {
      throw new HttpsError('invalid-argument', 'Context too long.');
    }

    const isAdmin = !!request.auth?.token?.admin;
    const resetTime = getNextMidnightUTC();

    if (!isAdmin) {
      await assertNotKilled('translate');
    }

    const { charsUsedAfter } = await reserveTranslationBudget(
      userId,
      text.length,
      isAdmin,
      resetTime
    );

    const apiKey = deeplApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Translation service is not configured.');
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

    if (declensionCardId && typeof declensionCardId === 'number' && targetLang === 'EN') {
      const cacheKey = cleanTextForCacheKey(text);
      if (cacheKey) {
        const cardRef = db.collection('declensionCards').doc(String(declensionCardId));
        const cardSnap = await cardRef.get();
        const sourceText =
          cardSnap.exists && typeof cardSnap.data()?.back === 'string'
            ? (cardSnap.data()?.back as string)
            : '';
        if (cacheKeyAppearsInSource(cacheKey, sourceText)) {
          await cardRef.update({
            [`translations.${cacheKey}`]: translatedText,
          });
        }
      }
    }

    if (sentenceId && typeof sentenceId === 'string' && targetLang === 'EN') {
      const cacheKey = cleanTextForCacheKey(text);
      if (cacheKey) {
        const sentenceRef = db.collection('sentences').doc(sentenceId);
        const sentenceSnap = await sentenceRef.get();
        const sourceText =
          sentenceSnap.exists && typeof sentenceSnap.data()?.polish === 'string'
            ? (sentenceSnap.data()?.polish as string)
            : '';
        if (cacheKeyAppearsInSource(cacheKey, sourceText)) {
          await sentenceRef.update({
            [`translations.${cacheKey}`]: translatedText,
          });
        }
      }
    }

    return {
      translatedText,
      charsUsedToday: charsUsedAfter,
      resetTime,
    };
  }
);

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

function validateRequest(data: TranslateRequest) {
  const { text, targetLang, context } = data;
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
}

async function requestDeepL(
  apiKey: string,
  text: string,
  targetLang: 'EN' | 'PL',
  context: string | undefined
): Promise<string> {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: targetLang === 'EN' ? 'PL' : 'EN',
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
  return translatedText;
}

/** Caches a word translation on its source doc, only if the word actually appears in `sourceField`. */
async function cacheTranslationOnDoc(
  docRef: FirebaseFirestore.DocumentReference,
  sourceField: string,
  text: string,
  translatedText: string
) {
  const cacheKey = cleanTextForCacheKey(text);
  if (!cacheKey) return;

  const snap = await docRef.get();
  const source = snap.exists ? snap.data()?.[sourceField] : undefined;
  if (cacheKeyAppearsInSource(cacheKey, typeof source === 'string' ? source : '')) {
    await docRef.update({ [`translations.${cacheKey}`]: translatedText });
  }
}

export const translate = onCall<TranslateRequest, Promise<TranslateResponse>>(
  { secrets: [deeplApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use the translator.');
    }

    validateRequest(request.data);
    const userId = request.auth.uid;
    const { text, targetLang, context, declensionCardId, sentenceId } = request.data;

    const isAdmin = !!request.auth.token?.admin;
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

    const translatedText = await requestDeepL(apiKey, text, targetLang, context);

    if (targetLang === 'EN') {
      if (declensionCardId && typeof declensionCardId === 'number') {
        const cardRef = db.collection('declensionCards').doc(String(declensionCardId));
        await cacheTranslationOnDoc(cardRef, 'back', text, translatedText);
      }
      if (sentenceId && typeof sentenceId === 'string') {
        const sentenceRef = db.collection('sentences').doc(sentenceId);
        await cacheTranslationOnDoc(sentenceRef, 'polish', text, translatedText);
      }
    }

    return {
      translatedText,
      charsUsedToday: charsUsedAfter,
      resetTime,
    };
  }
);

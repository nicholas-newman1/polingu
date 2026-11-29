import { onCall, HttpsError } from 'firebase-functions/https';
import { db } from '../shared/firebase.js';
import { deeplApiKey } from '../shared/secrets.js';
import { requestDeepL, requireDeepLKey } from '../shared/deepl.js';
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
  vocabulary?: boolean;
}

interface TranslateResponse {
  translatedText: string;
  charsUsedToday: number;
  resetTime: string;
}

function validateRequest(data: TranslateRequest) {
  const { text, targetLang, context, vocabulary } = data;
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
  if (vocabulary !== undefined && typeof vocabulary !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Vocabulary must be a boolean.');
  }
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
    const { text, targetLang, context, declensionCardId, sentenceId, vocabulary } = request.data;

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

    const apiKey = requireDeepLKey();
    const translatedText = await requestDeepL(apiKey, text, targetLang, { context, vocabulary });

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

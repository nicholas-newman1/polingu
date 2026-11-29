import { onCall, HttpsError } from 'firebase-functions/https';
import { createConfiguredOpenAI } from '../shared/openai.js';
import { requestDeepL, requireDeepLKey } from '../shared/deepl.js';
import { deeplApiKey, openaiApiKey } from '../shared/secrets.js';
import { CEFRLevel, requestCEFRLevel } from '../shared/cefr.js';

interface ProcessSentenceRequest {
  text: string;
  sourceLang: 'EN' | 'PL';
}

interface ProcessSentenceResponse {
  polish: string;
  english: string;
  level: CEFRLevel;
}

export const processSentence = onCall<ProcessSentenceRequest, Promise<ProcessSentenceResponse>>(
  { secrets: [deeplApiKey, openaiApiKey] },
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { text, sourceLang } = request.data;

    if (!text || typeof text !== 'string' || text.length > 500) {
      throw new HttpsError('invalid-argument', 'Valid text required (max 500 chars).');
    }

    if (sourceLang !== 'EN' && sourceLang !== 'PL') {
      throw new HttpsError('invalid-argument', 'Source language must be EN or PL.');
    }

    // Both services are checked before either is used, so a missing key costs no translation.
    const deeplKey = requireDeepLKey();
    const openai = await createConfiguredOpenAI();

    const translatedText = await requestDeepL(deeplKey, text, sourceLang === 'EN' ? 'PL' : 'EN');
    const polish = sourceLang === 'PL' ? text : translatedText;
    const english = sourceLang === 'EN' ? text : translatedText;

    const level: CEFRLevel = (await requestCEFRLevel(openai, polish)) ?? 'B1';

    return { polish, english, level };
  }
);

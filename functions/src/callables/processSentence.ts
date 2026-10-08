import { onCall, HttpsError } from 'firebase-functions/https';
import { createOpenAI } from '../shared/openai.js';
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

    const deeplKey = deeplApiKey.value();
    const openaiKey = openaiApiKey.value();

    if (!deeplKey || !openaiKey) {
      throw new HttpsError('failed-precondition', 'Services not configured.');
    }

    const targetLang = sourceLang === 'EN' ? 'PL' : 'EN';
    const translateResponse = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deeplKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
    });

    if (!translateResponse.ok) {
      throw new HttpsError('internal', 'Translation failed.');
    }

    const translateData = await translateResponse.json();
    const translatedText = translateData.translations?.[0]?.text;

    if (!translatedText) {
      throw new HttpsError('internal', 'No translation returned.');
    }

    const polish = sourceLang === 'PL' ? text : translatedText;
    const english = sourceLang === 'EN' ? text : translatedText;

    const openai = await createOpenAI(openaiKey);

    const level: CEFRLevel = (await requestCEFRLevel(openai, polish)) ?? 'B1';

    return { polish, english, level };
  }
);

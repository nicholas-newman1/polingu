import { HttpsError } from 'firebase-functions/https';
import { deeplApiKey } from './secrets.js';

const VOCABULARY_INFINITIVE_INSTRUCTION =
  'When the Polish vocabulary entry is an infinitive verb or infinitive phrase, including reflexive verbs, translate it as an English infinitive phrase beginning with "to" (e.g. jeść: to eat; móc: to be able to; musieć: to have to).';

/** The configured DeepL key; callables fail with `failed-precondition` without one. */
export function requireDeepLKey(): string {
  const apiKey = deeplApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Translation service is not configured.');
  }
  return apiKey;
}

/** Translates between Polish and English; the source language is the other of the two. */
export async function requestDeepL(
  apiKey: string,
  text: string,
  targetLang: 'EN' | 'PL',
  { context, vocabulary }: { context?: string; vocabulary?: boolean } = {}
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
      ...(vocabulary &&
        targetLang === 'EN' && {
          custom_instructions: [VOCABULARY_INFINITIVE_INSTRUCTION],
        }),
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

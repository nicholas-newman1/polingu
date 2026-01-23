import { setGlobalOptions } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import OpenAI from 'openai';

initializeApp();
const db = getFirestore();

const deeplApiKey = defineSecret('DEEPL_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

setGlobalOptions({ maxInstances: 10 });

const MAX_TEXT_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_CHARS_PER_DAY = 1500;

interface TranslateRequest {
  text: string;
  targetLang: 'EN' | 'PL';
  context?: string;
  declensionCardId?: number;
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

function cleanTextForCacheKey(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?;:"""''()]/g, '').toLowerCase())
    .filter(Boolean)
    .join(' ');
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
    const { text, targetLang, context, declensionCardId } = request.data;

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

    if (
      declensionCardId &&
      typeof declensionCardId === 'number' &&
      targetLang === 'EN'
    ) {
      const cacheKey = cleanTextForCacheKey(text);
      if (cacheKey) {
        const cardRef = db
          .collection('declensionCards')
          .doc(String(declensionCardId));
        await cardRef.update({
          [`translations.${cacheKey}`]: translatedText,
        });
      }
    }

    return {
      translatedText,
      charsUsedToday: newCharsUsed,
      resetTime,
    };
  }
);

interface GenerateExampleRequest {
  polish: string;
  english: string;
  partOfSpeech?: string;
  gender?: string;
  context?: string;
}

interface GeneratedExample {
  polish: string;
  english: string;
  meaning?: string;
}

interface GenerateExampleResponse {
  examples: GeneratedExample[];
}

export const generateExample = onCall<
  GenerateExampleRequest,
  Promise<GenerateExampleResponse>
>({ secrets: [openaiApiKey] }, async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { polish, english, partOfSpeech, gender, context } = request.data;

  if (!polish || typeof polish !== 'string') {
    throw new HttpsError('invalid-argument', 'Polish word is required.');
  }

  if (!english || typeof english !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'English translation is required.'
    );
  }

  const apiKey = openaiApiKey.value();
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'AI service is not configured.'
    );
  }

  const openai = new OpenAI({ apiKey });

  const promptParts = [
    `Generate 2-3 natural Polish example sentences using the word "${polish}" (${english}).`,
  ];

  if (partOfSpeech) {
    promptParts.push(`Part of speech: ${partOfSpeech}`);
  }
  if (gender) {
    promptParts.push(`Gender: ${gender}`);
  }
  if (context) {
    promptParts.push(`Additional context: ${context}`);
  }

  promptParts.push(`
Requirements:
- If the word has multiple meanings, provide one sentence for each distinct meaning
- If the word has only one meaning, provide 2-3 sentences showing different contexts/usages
- Keep sentences at A2-B1 difficulty level (intermediate learner)
- Each sentence should clearly demonstrate the word's meaning and typical usage
- Use natural, everyday Polish
- The word may be conjugated/declined as appropriate
- Include a short "meaning" hint (1-2 words) when there are multiple meanings

Respond with ONLY valid JSON (no markdown):
{ "examples": [{ "polish": "...", "english": "...", "meaning": "..." }, ...] }

The "meaning" field is optional - only include it when distinguishing between different senses of the word.`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a Polish language expert helping create example sentences for vocabulary flashcards. Always respond with valid JSON only, no markdown formatting.',
      },
      {
        role: 'user',
        content: promptParts.join('\n'),
      },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpsError('internal', 'No response from AI.');
  }

  try {
    const parsed = JSON.parse(content) as GenerateExampleResponse;
    if (
      !parsed.examples ||
      !Array.isArray(parsed.examples) ||
      parsed.examples.length === 0
    ) {
      throw new Error('Invalid response structure');
    }
    for (const ex of parsed.examples) {
      if (!ex.polish || !ex.english) {
        throw new Error('Invalid example structure');
      }
    }
    return parsed;
  } catch {
    console.error('Failed to parse AI response:', content);
    throw new HttpsError('internal', 'Failed to parse AI response.');
  }
});

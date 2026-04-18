import { setGlobalOptions } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/https';
import { onDocumentWritten } from 'firebase-functions/firestore';
import { onTaskDispatched } from 'firebase-functions/tasks';
import { defineSecret } from 'firebase-functions/params';
import { getFunctions } from 'firebase-admin/functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import OpenAI, { toFile } from 'openai';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';

initializeApp();

export { processBookUpload, deleteBook, getStorageUsage } from './reader.js';
export {
  processAudioUpload,
  transcribeAudio,
  deleteUserAudio,
  createUserAudio,
  processUserTextAudio,
} from './audio.js';
const db = getFirestore();
const ttsClient = new TextToSpeechClient();
const storage = new Storage();

const deeplApiKey = defineSecret('DEEPL_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

setGlobalOptions({ maxInstances: 10 });

// Audio generation configuration
const AUDIO_BUCKET = 'polingu-audio';
const DEFAULT_BUCKET = 'polish-declension.firebasestorage.app';
const AUDIO_CONFIG: protos.google.cloud.texttospeech.v1.IAudioConfig = {
  audioEncoding: 'MP3',
};
const TTS_VOICE = {
  languageCode: 'pl-PL',
  name: 'pl-PL-Wavenet-B',
};

const MAX_TEXT_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 120;
const MAX_CHARS_PER_DAY = 1500;

function stripMarkdownCodeFences(content: string): string {
  let result = content.trim();
  if (result.startsWith('```json')) {
    result = result.slice(7);
  } else if (result.startsWith('```')) {
    result = result.slice(3);
  }
  if (result.endsWith('```')) {
    result = result.slice(0, -3);
  }
  return result.trim();
}

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
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
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
    const rateLimitData = await getRateLimitDoc(userId);
    const resetTime = getNextMidnightUTC();

    if (!isAdmin) {
      if (!checkMinuteRateLimit(rateLimitData.recentRequests)) {
        throw new HttpsError('resource-exhausted', 'RATE_LIMIT_MINUTE');
      }

      if (rateLimitData.dailyCharsUsed + text.length > MAX_CHARS_PER_DAY) {
        throw new HttpsError('resource-exhausted', `RATE_LIMIT_DAILY:${resetTime}`);
      }
    }

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

    if (declensionCardId && typeof declensionCardId === 'number' && targetLang === 'EN') {
      const cacheKey = cleanTextForCacheKey(text);
      if (cacheKey) {
        const cardRef = db.collection('declensionCards').doc(String(declensionCardId));
        await cardRef.update({
          [`translations.${cacheKey}`]: translatedText,
        });
      }
    }

    if (sentenceId && typeof sentenceId === 'string' && targetLang === 'EN') {
      const cacheKey = cleanTextForCacheKey(text);
      if (cacheKey) {
        const sentenceRef = db.collection('sentences').doc(sentenceId);
        await sentenceRef.update({
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

export const generateExample = onCall<GenerateExampleRequest, Promise<GenerateExampleResponse>>(
  { secrets: [openaiApiKey] },
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { polish, english, partOfSpeech, gender, context } = request.data;

    if (!polish || typeof polish !== 'string') {
      throw new HttpsError('invalid-argument', 'Polish word is required.');
    }

    if (!english || typeof english !== 'string') {
      throw new HttpsError('invalid-argument', 'English translation is required.');
    }

    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'AI service is not configured.');
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
      const cleaned = stripMarkdownCodeFences(content);
      const parsed = JSON.parse(cleaned) as GenerateExampleResponse;
      if (!parsed.examples || !Array.isArray(parsed.examples) || parsed.examples.length === 0) {
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
  }
);

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface GeneratedSentence {
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
}

interface GenerateSentencesRequest {
  level: CEFRLevel;
  tags: string[];
  count: number;
  guidance?: string;
}

interface GenerateSentencesResponse {
  sentences: GeneratedSentence[];
}

const SENTENCE_SYSTEM_PROMPT = `You are a Polish language expert creating sentences for a language learning app.

Your task: Generate natural Polish sentences with their English translations.

REQUIREMENTS:
1. Generate sentences appropriate for the specified CEFR level
2. Use natural, everyday Polish that native speakers would actually say
3. Provide accurate English translations

Respond with ONLY valid JSON (no markdown):
{ "sentences": [{ "polish": "...", "english": "...", "level": "...", "tags": [...] }, ...] }`;

export const generateSentences = onCall<
  GenerateSentencesRequest,
  Promise<GenerateSentencesResponse>
>({ secrets: [openaiApiKey] }, async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { level, tags, count, guidance } = request.data;

  if (!level || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
    throw new HttpsError('invalid-argument', 'Valid CEFR level required.');
  }

  if (!Array.isArray(tags)) {
    throw new HttpsError('invalid-argument', 'Tags must be an array.');
  }

  const apiKey = openaiApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI service is not configured.');
  }

  const openai = new OpenAI({ apiKey });

  const variationSeed = Math.random().toString(36).slice(2, 10);
  const userPrompt = [
    `Generate ${count} Polish sentence(s) at CEFR level ${level}.`,
    tags.length > 0 ? `Topics/themes to include: ${tags.join(', ')}` : '',
    guidance ? `Additional guidance: ${guidance}` : '',
    `[variation: ${variationSeed}]`,
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SENTENCE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpsError('internal', 'No response from AI.');
  }

  try {
    const cleaned = stripMarkdownCodeFences(content);
    const parsed = JSON.parse(cleaned) as GenerateSentencesResponse;
    if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
      throw new Error('Invalid response structure');
    }

    for (const sentence of parsed.sentences) {
      if (!sentence.polish || !sentence.english) {
        throw new Error('Invalid sentence structure');
      }
      sentence.level = level;
      sentence.tags = tags;
    }

    return parsed;
  } catch {
    console.error('Failed to parse AI response:', content);
    throw new HttpsError('internal', 'Failed to parse AI response.');
  }
});

interface CurriculumDiscoveryRequest {
  mode: 'grammar' | 'topics' | 'polish-specific' | 'freeform';
  level?: CEFRLevel;
  freeformQuestion?: string;
  existingTags: {
    topics: string[];
    grammar: string[];
    style: string[];
  };
}

interface CurriculumSuggestion {
  tag: string;
  category: 'topics' | 'grammar' | 'style';
  priority: 'high' | 'medium' | 'low';
  explanation: string;
  exampleConcepts: string[];
  relevantLevels: CEFRLevel[];
}

interface CurriculumDiscoveryResponse {
  suggestions: CurriculumSuggestion[];
}

const CURRICULUM_SYSTEM_PROMPT = `You are a Polish language curriculum expert helping design a comprehensive learning app.

Your task: Identify MISSING grammar concepts, topics, or themes that should be added to the curriculum.

The app teaches Polish through sentences with word-by-word annotations. Each sentence is tagged with:
- Topics (e.g., food, travel, health)
- Grammar concepts (e.g., conditional, past tense, subjunctive)
- Style (e.g., formal, informal, advice)

POLISH-SPECIFIC CONCEPTS TO CONSIDER:
1. Verbal aspect (perfective vs imperfective) - FUNDAMENTAL to Polish
2. Verb prefixes and their meanings (na-, za-, wy-, przy-, po-, etc.)
3. Motion verbs (determinate/indeterminate: iść/chodzić, jechać/jeździć)
4. Reflexive verbs (się constructions)
5. Impersonal constructions (trzeba, można, wolno)
6. Numeral declension (complex agreement patterns)
7. Diminutives and augmentatives
8. Participles (present active, past passive, etc.)
9. Verbal nouns (-nie/-cie endings)
10. Case usage after specific verbs/prepositions

When suggesting new tags:
- Explain WHY this concept is important for learners
- Specify which CEFR levels need this concept
- Give concrete examples of what sentences would cover

Respond with ONLY valid JSON (no markdown):
{ "suggestions": [{ "tag": "...", "category": "grammar|topics|style", "priority": "high|medium|low", "explanation": "...", "exampleConcepts": [...], "relevantLevels": [...] }, ...] }`;

export const discoverCurriculum = onCall<
  CurriculumDiscoveryRequest,
  Promise<CurriculumDiscoveryResponse>
>({ secrets: [openaiApiKey] }, async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { mode, level, freeformQuestion, existingTags } = request.data;

  if (!existingTags) {
    throw new HttpsError('invalid-argument', 'Existing tags required.');
  }

  const apiKey = openaiApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI service is not configured.');
  }

  const openai = new OpenAI({ apiKey });

  let userPrompt: string;

  if (mode === 'freeform' && freeformQuestion) {
    userPrompt = `Question: ${freeformQuestion}

Current curriculum tags:
- Topics: ${existingTags.topics.join(', ') || 'none'}
- Grammar: ${existingTags.grammar.join(', ') || 'none'}
- Style: ${existingTags.style.join(', ') || 'none'}

Based on the question, suggest new tags that should be added to the curriculum.`;
  } else {
    const modeDescriptions: Record<string, string> = {
      grammar: 'What Polish GRAMMAR concepts are missing from this curriculum?',
      topics: 'What everyday TOPICS or situations should be added?',
      'polish-specific':
        'What POLISH-SPECIFIC linguistic features (aspect, motion verbs, etc.) are missing?',
    };

    userPrompt = `${modeDescriptions[mode] || modeDescriptions.grammar}

${level ? `Focus on CEFR level: ${level}` : 'Consider all CEFR levels.'}

Current curriculum tags:
- Topics: ${existingTags.topics.join(', ') || 'none'}
- Grammar: ${existingTags.grammar.join(', ') || 'none'}
- Style: ${existingTags.style.join(', ') || 'none'}

Suggest 3-5 high-value additions that are currently MISSING.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: CURRICULUM_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpsError('internal', 'No response from AI.');
  }

  try {
    const cleaned = stripMarkdownCodeFences(content);
    const parsed = JSON.parse(cleaned) as CurriculumDiscoveryResponse;
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid response structure');
    }
    return parsed;
  } catch {
    console.error('Failed to parse AI response:', content);
    throw new HttpsError('internal', 'Failed to parse AI response.');
  }
});

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

    const openai = new OpenAI({ apiKey: openaiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You assess Polish sentences for CEFR level. Respond with ONLY the level: A1, A2, B1, B2, C1, or C2.',
        },
        { role: 'user', content: polish },
      ],
      temperature: 0.2,
      max_tokens: 10,
    });

    const levelResponse = completion.choices[0]?.message?.content?.trim().toUpperCase();
    const level = (
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(levelResponse || '') ? levelResponse : 'B1'
    ) as CEFRLevel;

    return { polish, english, level };
  }
);

// Audio generation types
type AudioType =
  | 'sentence'
  | 'declension'
  | 'vocabulary'
  | 'conjugation'
  | 'verb-infinitive'
  | 'custom-sentence'
  | 'custom-vocabulary'
  | 'custom-declension';

interface GenerateAudioPreviewRequest {
  text: string;
  type: AudioType;
}

interface GenerateAudioPreviewResponse {
  audioBase64: string;
}

export const generateAudioPreview = onCall<
  GenerateAudioPreviewRequest,
  Promise<GenerateAudioPreviewResponse>
>(async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { text } = request.data;

  if (!text || typeof text !== 'string' || text.length > 1000) {
    throw new HttpsError('invalid-argument', 'Valid text required (max 1000 chars).');
  }

  try {
    const ttsRequest = {
      input: { text },
      voice: TTS_VOICE,
      audioConfig: AUDIO_CONFIG,
    };

    const [response] = await ttsClient.synthesizeSpeech(ttsRequest);

    if (!response.audioContent) {
      throw new Error('No audio content in response');
    }

    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');

    return { audioBase64 };
  } catch (error) {
    console.error('TTS error:', error);
    throw new HttpsError('internal', 'Failed to generate audio.');
  }
});

interface SaveAudioRequest {
  audioBase64: string;
  type: AudioType;
  id: string;
  subPath?: string; // For conjugation: "{verbId}_{tense}_{formKey}"
}

interface SaveAudioResponse {
  audioUrl: string;
}

function getAudioPath(type: AudioType, id: string, subPath?: string, userId?: string): string {
  switch (type) {
    case 'sentence':
      return `sentences/${id}.mp3`;
    case 'declension':
      return `declension/${id}.mp3`;
    case 'vocabulary':
      return `vocabulary/${id}.mp3`;
    case 'conjugation':
      return `conjugation/${subPath || id}.mp3`;
    case 'verb-infinitive':
      return `verb-infinitives/${id}.mp3`;
    case 'custom-sentence':
      return `custom/${userId}/sentences/${id}.mp3`;
    case 'custom-vocabulary':
      return `custom/${userId}/vocabulary/${id}.mp3`;
    case 'custom-declension':
      return `custom/${userId}/declension/${id}.mp3`;
    default:
      throw new Error(`Unknown audio type: ${type}`);
  }
}

async function updateFirestoreAudioUrl(
  type: AudioType,
  id: string,
  audioUrl: string,
  subPath?: string
): Promise<void> {
  switch (type) {
    case 'sentence':
      await db.collection('sentences').doc(id).update({ audioUrl });
      break;
    case 'declension':
      await db.collection('declensionCards').doc(id).update({ audioUrl });
      break;
    case 'vocabulary':
      await db.collection('vocabulary').doc(id).update({ audioUrl });
      break;
    case 'conjugation':
      if (subPath) {
        const parts = subPath.split('_');
        const verbId = parts[0];
        const tense = parts[1];
        const formKey = parts.slice(2).join('_');
        await db
          .collection('verbs')
          .doc(verbId)
          .update({ [`conjugations.${tense}.${formKey}.audioUrl`]: audioUrl });
      }
      break;
    case 'verb-infinitive':
      await db.collection('verbs').doc(id).update({ infinitiveAudioUrl: audioUrl });
      break;
    case 'custom-sentence':
    case 'custom-vocabulary':
    case 'custom-declension':
      // Custom card audio URLs are written by the client after saveAudio resolves.
      break;
  }
}

async function synthesizeAndUploadAudio(
  text: string,
  audioType: AudioType,
  id: string,
  subPath?: string,
  userId?: string
): Promise<string | null> {
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: TTS_VOICE,
    audioConfig: AUDIO_CONFIG,
  });

  if (!response.audioContent) return null;

  const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
  const filePath = getAudioPath(audioType, id, subPath, userId);
  const bucket = storage.bucket(AUDIO_BUCKET);
  await bucket.file(filePath).save(audioBuffer, {
    contentType: 'audio/mpeg',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });

  return `https://storage.googleapis.com/${AUDIO_BUCKET}/${filePath}?v=${Date.now()}`;
}

export const saveAudio = onCall<SaveAudioRequest, Promise<SaveAudioResponse>>(async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { audioBase64, type, id, subPath } = request.data;
  const userId = request.auth.uid;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'Audio data required.');
  }

  if (!type || !id) {
    throw new HttpsError('invalid-argument', 'Type and ID required.');
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const filePath = getAudioPath(type, id, subPath, userId);
    const bucket = storage.bucket(AUDIO_BUCKET);
    const file = bucket.file(filePath);

    await file.save(audioBuffer, {
      contentType: 'audio/mpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    const audioUrl = `https://storage.googleapis.com/${AUDIO_BUCKET}/${filePath}?v=${Date.now()}`;

    await updateFirestoreAudioUrl(type, id, audioUrl, subPath);

    return { audioUrl };
  } catch (error) {
    console.error('Storage error:', error);
    throw new HttpsError('internal', 'Failed to save audio.');
  }
});

// ---------------------------------------------------------------------------
// System Audio (admin-curated audios visible to all users)
// ---------------------------------------------------------------------------

interface SystemTranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface SystemTranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: SystemTranscriptWord[];
}

interface CreateSystemAudioRequest {
  title: string;
  text: string;
}

export const createSystemAudio = onCall<CreateSystemAudioRequest, Promise<{ id: string }>>(
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { title, text } = request.data;
    if (!title || typeof title !== 'string') {
      throw new HttpsError('invalid-argument', 'Title is required.');
    }
    if (!text || typeof text !== 'string' || text.length > 50000) {
      throw new HttpsError('invalid-argument', 'Valid text required (max 50,000 chars).');
    }

    const docRef = db.collection('systemAudioItems').doc();
    const id = docRef.id;

    await docRef.set({
      id,
      title,
      text,
      storagePath: '',
      duration: 0,
      status: 'processing',
      transcript: [],
      createdAt: Date.now(),
    });

    const queue = getFunctions().taskQueue('processSystemAudio');
    await queue.enqueue({ id }, { dispatchDeadlineSeconds: 600 });

    return { id };
  }
);

interface ProcessSystemAudioTaskData {
  id: string;
}

const TTS_BYTE_LIMIT = 3500;

function chunkTextForTTS(text: string): string[] {
  if (Buffer.byteLength(text, 'utf8') <= TTS_BYTE_LIMIT) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (Buffer.byteLength(candidate, 'utf8') > TTS_BYTE_LIMIT && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export const processSystemAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { id } = req.data as ProcessSystemAudioTaskData;
    const docRef = db.collection('systemAudioItems').doc(id);

    try {
      const docSnap = await docRef.get();
      if (!docSnap.exists) throw new Error('System audio doc not found.');
      const row = docSnap.data() as { text: string };
      const { text } = row;

      const chunks = chunkTextForTTS(text);
      const audioChunks: Buffer[] = [];

      for (const chunk of chunks) {
        const [ttsResponse] = await ttsClient.synthesizeSpeech({
          input: { text: chunk },
          voice: TTS_VOICE,
          audioConfig: AUDIO_CONFIG,
        });
        if (!ttsResponse.audioContent) throw new Error('TTS produced no audio.');
        audioChunks.push(Buffer.from(ttsResponse.audioContent as Uint8Array));
      }

      const audioBuffer = Buffer.concat(audioChunks);
      const finalPath = `audio/system/${id}/audio.mp3`;
      const bucket = storage.bucket(DEFAULT_BUCKET);

      await bucket.file(finalPath).save(audioBuffer, {
        contentType: 'audio/mpeg',
      });

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new Error('OpenAI API key not configured.');

      const openai = new OpenAI({ apiKey });
      const audioFile = await toFile(audioBuffer, 'system-audio.mp3');

      const whisper = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
        language: 'pl',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const duration = whisper.duration ?? 0;

      const segments: SystemTranscriptSegment[] = (whisper.segments ?? []).map((seg) => ({
        text: seg.text.trim(),
        startTime: seg.start,
        endTime: seg.end,
        words: [],
      }));

      const words: SystemTranscriptWord[] = (whisper.words ?? []).map((w) => ({
        word: w.word,
        startTime: w.start,
        endTime: w.end,
        confidence: 1,
      }));

      for (const word of words) {
        const seg = segments.find(
          (s) => word.startTime >= s.startTime && word.startTime < s.endTime
        );
        if (seg) {
          seg.words.push(word);
        } else if (segments.length > 0) {
          const closest = segments.reduce((prev, curr) =>
            Math.abs(curr.startTime - word.startTime) < Math.abs(prev.startTime - word.startTime)
              ? curr
              : prev
          );
          closest.words.push(word);
        }
      }

      await docRef.update({
        storagePath: finalPath,
        duration,
        status: 'ready',
        transcript: segments,
      });

      console.log(
        `System audio ${id} ready: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`System audio processing failed for ${id}:`, error);

      await docRef.update({ status: 'error', error: errorMessage });

      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(`audio/system/${id}/audio.mp3`).delete();
      } catch {
        // File might not exist yet
      }

      throw error;
    }
  }
);

interface DeleteSystemAudioRequest {
  id: string;
}

export const deleteSystemAudio = onCall<DeleteSystemAudioRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { id } = request.data;
    if (!id) {
      throw new HttpsError('invalid-argument', 'ID required.');
    }

    const docRef = db.collection('systemAudioItems').doc(id);
    const docSnap = await docRef.get();
    const storagePath = docSnap.data()?.storagePath;

    if (storagePath) {
      try {
        await storage.bucket(DEFAULT_BUCKET).file(storagePath).delete();
      } catch {
        // File might not exist
      }
    }

    await docRef.delete();

    return { success: true };
  }
);

// ---------------------------------------------------------------------------
// Auto-generate audio for new / edited custom cards (admin only)
// Firestore path: users/{userId}/{collection}/{cardId}
// ---------------------------------------------------------------------------

interface CustomCardItem {
  id: string;
  audioUrl?: string;
  polish?: string;
  back?: string;
  [key: string]: unknown;
}

interface PerCardTriggerConfig {
  audioType: AudioType;
  getText: (item: CustomCardItem) => string;
}

const PER_CARD_CONFIGS: Record<
  'customSentences' | 'customVocabulary' | 'customDeclension',
  PerCardTriggerConfig
> = {
  customSentences: { audioType: 'custom-sentence', getText: (i) => i.polish ?? '' },
  customVocabulary: { audioType: 'custom-vocabulary', getText: (i) => i.polish ?? '' },
  customDeclension: { audioType: 'custom-declension', getText: (i) => i.back ?? '' },
};

async function handlePerCardWrite(
  collectionName: keyof typeof PER_CARD_CONFIGS,
  userId: string,
  cardId: string,
  before: CustomCardItem | undefined,
  after: CustomCardItem | undefined,
  afterRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  if (!after) return;

  let isAdmin = false;
  try {
    const user = await getAuth().getUser(userId);
    isAdmin = !!user.customClaims?.admin;
  } catch (error) {
    console.warn(
      `onCustomCardWrite: Auth check failed for ${collectionName}/${cardId} (user ${userId}):`,
      error
    );
    return;
  }
  if (!isAdmin) return;

  const config = PER_CARD_CONFIGS[collectionName];
  const beforeText = before ? config.getText(before).trim() : '';
  const afterText = config.getText(after).trim();
  if (!afterText) return;

  const isCreate = !before;
  if (isCreate && after.audioUrl) return;
  if (!isCreate && beforeText === afterText) return;

  try {
    const audioUrl = await synthesizeAndUploadAudio(
      afterText,
      config.audioType,
      cardId,
      undefined,
      userId
    );
    if (!audioUrl) return;

    await afterRef.update({ audioUrl });
    console.log(`Generated audio for ${collectionName}/${cardId} (user ${userId})`);
  } catch (error) {
    console.error(
      `Failed to generate audio for ${collectionName}/${cardId} (user ${userId}):`,
      error
    );
  }
}

export const onCustomSentenceWrite = onDocumentWritten(
  'users/{userId}/customSentences/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customSentences',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

export const onCustomVocabularyWrite = onDocumentWritten(
  'users/{userId}/customVocabulary/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customVocabulary',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

export const onCustomDeclensionWrite = onDocumentWritten(
  'users/{userId}/customDeclension/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customDeclension',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

// ---------------------------------------------------------------------------
// Auto-generate / regenerate audio for system cards
// Fires on create (when audio is missing) and on update (when the tracked
// text field changes). Single-audio cards run inline; verbs enqueue a Cloud
// Task because they may need 20+ TTS calls per doc.
//
// Loop prevention: each handler early-returns when only audio metadata
// fields (audioUrl / audioStatus / audioError / conjugation audio URLs)
// changed, by comparing only the source text field(s) of before vs after.
// ---------------------------------------------------------------------------

type CardAudioStatus = 'generating' | 'ready' | 'error';

interface SystemCardAudioConfig {
  audioType: AudioType;
  getText: (data: FirebaseFirestore.DocumentData) => string;
}

const SYSTEM_CARD_AUDIO_CONFIGS = {
  vocabulary: {
    audioType: 'vocabulary',
    getText: (d) => ((d.polish as string) ?? '').trim(),
  },
  sentences: {
    audioType: 'sentence',
    getText: (d) => ((d.polish as string) ?? '').trim(),
  },
  declensionCards: {
    audioType: 'declension',
    getText: (d) => ((d.back as string) ?? '').trim(),
  },
} satisfies Record<string, SystemCardAudioConfig>;

type SystemCardCollection = keyof typeof SYSTEM_CARD_AUDIO_CONFIGS;

async function handleSystemCardAudioWrite(
  collectionName: SystemCardCollection,
  docId: string,
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData | undefined
): Promise<void> {
  if (!after) return;

  const config = SYSTEM_CARD_AUDIO_CONFIGS[collectionName];
  const afterText = config.getText(after);
  if (!afterText) return;

  const isCreate = !before;
  const beforeText = before ? config.getText(before) : '';

  if (isCreate && (after.audioUrl as string | undefined)) return;
  if (!isCreate && beforeText === afterText) return;

  const docRef = db.collection(collectionName).doc(docId);

  try {
    await docRef.update({
      audioStatus: 'generating' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
  } catch (error) {
    console.error(`Failed to mark ${collectionName}/${docId} generating:`, error);
  }

  try {
    const audioUrl = await synthesizeAndUploadAudio(afterText, config.audioType, docId);
    if (!audioUrl) throw new Error('TTS returned no audio content.');

    await docRef.update({
      audioUrl,
      audioStatus: 'ready' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
    console.log(`Generated audio for ${collectionName}/${docId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audio generation failed';
    console.error(`Failed to generate audio for ${collectionName}/${docId}:`, error);
    try {
      await docRef.update({
        audioStatus: 'error' satisfies CardAudioStatus,
        audioError: message,
      });
    } catch (updateErr) {
      console.error(`Failed to record audio error for ${collectionName}/${docId}:`, updateErr);
    }
  }
}

export const onVocabularyWrite = onDocumentWritten('vocabulary/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'vocabulary',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

export const onSentenceWrite = onDocumentWritten('sentences/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'sentences',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

export const onDeclensionCardWrite = onDocumentWritten('declensionCards/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'declensionCards',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

// ---------------------------------------------------------------------------
// Verbs: compound cards with many audio fields -> enqueue a Cloud Task so we
// stay within per-invocation time budgets and get free retry/backoff.
// ---------------------------------------------------------------------------

interface ConjugationFormData {
  pl?: string;
  audioUrl?: string;
  [key: string]: unknown;
}

type ConjugationsData = Record<string, Record<string, ConjugationFormData>>;

interface VerbAudioJob {
  fieldPath: string;
  text: string;
  audioType: 'verb-infinitive' | 'conjugation';
  subPath?: string;
}

interface GenerateVerbAudioTaskData {
  docId: string;
  jobs: VerbAudioJob[];
}

function collectVerbAudioJobs(
  docId: string,
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData
): VerbAudioJob[] {
  const isCreate = !before;
  const jobs: VerbAudioJob[] = [];

  const beforeInf = ((before?.infinitive as string) ?? '').trim();
  const afterInf = ((after.infinitive as string) ?? '').trim();
  if (afterInf) {
    const infinitiveExists = !!(after.infinitiveAudioUrl as string | undefined);
    const shouldGenerateInfinitive = isCreate ? !infinitiveExists : beforeInf !== afterInf;
    if (shouldGenerateInfinitive) {
      jobs.push({
        fieldPath: 'infinitiveAudioUrl',
        text: afterInf,
        audioType: 'verb-infinitive',
      });
    }
  }

  const beforeConj = (before?.conjugations ?? {}) as ConjugationsData;
  const afterConj = (after.conjugations ?? {}) as ConjugationsData;

  for (const [tense, forms] of Object.entries(afterConj)) {
    for (const [formKey, form] of Object.entries(forms)) {
      const afterPl = (form.pl ?? '').trim();
      if (!afterPl) continue;

      const beforePl = (beforeConj[tense]?.[formKey]?.pl ?? '').trim();
      const formHasAudio = !!form.audioUrl;

      const shouldGenerate = isCreate ? !formHasAudio : beforePl !== afterPl;
      if (!shouldGenerate) continue;

      jobs.push({
        fieldPath: `conjugations.${tense}.${formKey}.audioUrl`,
        text: afterPl,
        audioType: 'conjugation',
        subPath: `${docId}_${tense}_${formKey}`,
      });
    }
  }

  return jobs;
}

export const onVerbWrite = onDocumentWritten('verbs/{docId}', async (event) => {
  const { docId } = event.params;
  const after = event.data?.after?.data();
  if (!after) return;

  const jobs = collectVerbAudioJobs(docId, event.data?.before?.data(), after);
  if (jobs.length === 0) return;

  const docRef = db.collection('verbs').doc(docId);
  try {
    await docRef.update({
      audioStatus: 'generating' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
  } catch (error) {
    console.error(`Failed to mark verbs/${docId} generating:`, error);
  }

  try {
    const queue = getFunctions().taskQueue('generateVerbAudio');
    await queue.enqueue({ docId, jobs } satisfies GenerateVerbAudioTaskData, {
      dispatchDeadlineSeconds: 600,
    });
    console.log(`Enqueued ${jobs.length} audio job(s) for verbs/${docId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enqueue audio task';
    console.error(`Failed to enqueue verb audio task for verbs/${docId}:`, error);
    try {
      await docRef.update({
        audioStatus: 'error' satisfies CardAudioStatus,
        audioError: message,
      });
    } catch (updateErr) {
      console.error(`Failed to record enqueue error for verbs/${docId}:`, updateErr);
    }
  }
});

export const generateVerbAudio = onTaskDispatched<GenerateVerbAudioTaskData>(
  {
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { docId, jobs } = req.data;
    const docRef = db.collection('verbs').doc(docId);

    const updates: Record<string, unknown> = {};
    const failures: string[] = [];

    for (const job of jobs) {
      try {
        const url = await synthesizeAndUploadAudio(job.text, job.audioType, docId, job.subPath);
        if (!url) {
          failures.push(`${job.fieldPath}: empty TTS response`);
          continue;
        }
        updates[job.fieldPath] = url;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Audio generation failed';
        failures.push(`${job.fieldPath}: ${message}`);
        console.error(`generateVerbAudio: ${job.fieldPath} failed for verbs/${docId}:`, error);
      }
    }

    const successCount = Object.keys(updates).length;

    if (failures.length === 0) {
      updates.audioStatus = 'ready' satisfies CardAudioStatus;
      updates.audioError = FieldValue.delete();
    } else {
      updates.audioStatus = 'error' satisfies CardAudioStatus;
      const preview = failures.slice(0, 5).join('; ');
      const suffix = failures.length > 5 ? ` (+${failures.length - 5} more)` : '';
      updates.audioError = `${failures.length} of ${jobs.length} job(s) failed: ${preview}${suffix}`;
    }

    try {
      await docRef.update(updates);
      console.log(
        `generateVerbAudio: verbs/${docId} wrote ${successCount} url(s), ${failures.length} failure(s)`
      );
    } catch (error) {
      console.error(`generateVerbAudio: failed to persist updates for verbs/${docId}:`, error);
      throw error;
    }

    if (successCount === 0 && failures.length > 0) {
      throw new Error(`All ${failures.length} verb audio jobs failed for verbs/${docId}`);
    }
  }
);

// ---------------------------------------------------------------------------
// Sync vocabulary example sentences <-> sentences collection (bi-directional)
// ---------------------------------------------------------------------------

const VOCAB_EXAMPLE_TAG = 'vocab-example';
const VOCAB_EXAMPLE_SOURCE = 'vocab-example';

interface VocabExampleDoc {
  id?: string;
  polish?: string;
  english?: string;
}

function mirrorSentenceIdFor(vocabId: string, exampleId: string): string {
  return `vocab-${vocabId}-${exampleId}`;
}

async function assessSentenceCEFR(polish: string, apiKey: string): Promise<CEFRLevel | null> {
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You assess Polish sentences for CEFR level. Respond with ONLY the level: A1, A2, B1, B2, C1, or C2.',
        },
        { role: 'user', content: polish },
      ],
      temperature: 0.2,
      max_tokens: 10,
    });
    const levelResponse = completion.choices[0]?.message?.content?.trim().toUpperCase() ?? '';
    if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(levelResponse)) {
      return levelResponse as CEFRLevel;
    }
    return null;
  } catch (error) {
    console.error('CEFR assessment failed:', error);
    return null;
  }
}

export const onVocabularyExamplesWrite = onDocumentWritten(
  { document: 'vocabulary/{wordId}', secrets: [openaiApiKey] },
  async (event) => {
    const wordId = event.params.wordId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) {
      if (!before) return;
      const examples = (before.examples ?? []) as VocabExampleDoc[];
      for (const ex of examples) {
        if (!ex.id) continue;
        const sentenceId = mirrorSentenceIdFor(wordId, ex.id);
        try {
          await db.collection('sentences').doc(sentenceId).delete();
        } catch (error) {
          console.error(`Failed to delete mirror sentence ${sentenceId}:`, error);
        }
      }
      return;
    }

    const beforeExamples = (before?.examples ?? []) as VocabExampleDoc[];
    const afterExamples = (after.examples ?? []) as VocabExampleDoc[];

    const beforeById = new Map<string, VocabExampleDoc>();
    for (const ex of beforeExamples) {
      if (ex.id) beforeById.set(ex.id, ex);
    }
    const afterById = new Map<string, VocabExampleDoc>();
    for (const ex of afterExamples) {
      if (ex.id) afterById.set(ex.id, ex);
    }

    for (const exId of beforeById.keys()) {
      if (afterById.has(exId)) continue;
      const sentenceId = mirrorSentenceIdFor(wordId, exId);
      try {
        await db.collection('sentences').doc(sentenceId).delete();
      } catch (error) {
        console.error(`Failed to delete mirror sentence ${sentenceId}:`, error);
      }
    }

    for (const [exId, afterEx] of afterById) {
      const polish = (afterEx.polish ?? '').trim();
      const english = (afterEx.english ?? '').trim();
      if (!polish || !english) continue;

      const beforeEx = beforeById.get(exId);
      const beforePolish = (beforeEx?.polish ?? '').trim();
      const beforeEnglish = (beforeEx?.english ?? '').trim();

      if (beforeEx && beforePolish === polish && beforeEnglish === english) continue;

      const sentenceId = mirrorSentenceIdFor(wordId, exId);
      const sentenceRef = db.collection('sentences').doc(sentenceId);
      const sentenceSnap = await sentenceRef.get();
      const existing = sentenceSnap.data();

      if (
        existing &&
        ((existing.polish as string) ?? '') === polish &&
        ((existing.english as string) ?? '') === english
      ) {
        continue;
      }

      const isCreate = !existing;
      const polishChanged = isCreate || beforePolish !== polish;

      let newLevel: CEFRLevel | null = null;
      if (polishChanged) {
        const apiKey = openaiApiKey.value();
        if (apiKey) {
          newLevel = await assessSentenceCEFR(polish, apiKey);
        }
      }

      if (isCreate) {
        if (!newLevel) {
          console.warn(
            `onVocabularyExamplesWrite: CEFR assessment failed for vocabulary/${wordId} example ${exId} - skipping mirror sentence creation`
          );
          continue;
        }
        try {
          await sentenceRef.set({
            id: sentenceId,
            polish,
            english,
            level: newLevel,
            tags: [VOCAB_EXAMPLE_TAG],
            source: VOCAB_EXAMPLE_SOURCE,
            sourceVocabularyId: wordId,
            sourceExampleId: exId,
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log(`Created mirror sentence ${sentenceId}`);
        } catch (error) {
          console.error(`Failed to create mirror sentence ${sentenceId}:`, error);
        }
        continue;
      }

      const updates: Record<string, unknown> = { polish, english };
      if (polishChanged && newLevel) {
        updates.level = newLevel;
      }
      try {
        await sentenceRef.update(updates);
      } catch (error) {
        console.error(`Failed to update mirror sentence ${sentenceId}:`, error);
      }
    }
  }
);

export const onSentenceVocabLinkWrite = onDocumentWritten(
  'sentences/{sentenceId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) {
      if (!before) return;
      if (before.source !== VOCAB_EXAMPLE_SOURCE) return;
      const vocabId = before.sourceVocabularyId as string | undefined;
      const exampleId = before.sourceExampleId as string | undefined;
      if (!vocabId || !exampleId) return;

      const vocabRef = db.collection('vocabulary').doc(vocabId);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(vocabRef);
          if (!snap.exists) return;
          const data = snap.data()!;
          const examples = (data.examples ?? []) as VocabExampleDoc[];
          const filtered = examples.filter((ex) => ex.id !== exampleId);
          if (filtered.length === examples.length) return;
          tx.update(vocabRef, { examples: filtered });
        });
      } catch (error) {
        console.error(
          `Failed to remove vocab example ${vocabId}/${exampleId} after sentence delete:`,
          error
        );
      }
      return;
    }

    if (after.source !== VOCAB_EXAMPLE_SOURCE) return;

    const vocabId = after.sourceVocabularyId as string | undefined;
    const exampleId = after.sourceExampleId as string | undefined;
    if (!vocabId || !exampleId) return;

    const afterPolish = ((after.polish as string) ?? '').trim();
    const afterEnglish = ((after.english as string) ?? '').trim();
    if (!afterPolish || !afterEnglish) return;

    const beforePolish = ((before?.polish as string) ?? '').trim();
    const beforeEnglish = ((before?.english as string) ?? '').trim();

    if (before && beforePolish === afterPolish && beforeEnglish === afterEnglish) return;

    const vocabRef = db.collection('vocabulary').doc(vocabId);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(vocabRef);
        if (!snap.exists) return;
        const data = snap.data()!;
        const examples = (data.examples ?? []) as VocabExampleDoc[];
        const idx = examples.findIndex((ex) => ex.id === exampleId);
        if (idx === -1) return;
        const current = examples[idx];
        const currentPolish = ((current.polish as string) ?? '').trim();
        const currentEnglish = ((current.english as string) ?? '').trim();
        if (currentPolish === afterPolish && currentEnglish === afterEnglish) return;
        const next = [...examples];
        next[idx] = { ...current, polish: afterPolish, english: afterEnglish };
        tx.update(vocabRef, { examples: next });
      });
    } catch (error) {
      console.error(
        `Failed to propagate sentence edit back to vocabulary/${vocabId} example ${exampleId}:`,
        error
      );
    }
  }
);

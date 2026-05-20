import { onCall, HttpsError } from 'firebase-functions/https';
import OpenAI from 'openai';
import { openaiApiKey } from '../shared/secrets.js';
import { stripMarkdownCodeFences } from '../shared/json.js';
import { CEFRLevel, isCEFRLevel } from '../shared/cefr.js';

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

  if (!level || !isCEFRLevel(level)) {
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

import { onCall, HttpsError } from 'firebase-functions/https';
import OpenAI from 'openai';
import { openaiApiKey } from '../shared/secrets.js';
import { stripMarkdownCodeFences } from '../shared/json.js';

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

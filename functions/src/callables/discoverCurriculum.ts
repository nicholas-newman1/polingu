import { onCall, HttpsError } from 'firebase-functions/https';
import OpenAI from 'openai';
import { openaiApiKey } from '../shared/secrets.js';
import { stripMarkdownCodeFences } from '../shared/json.js';
import { CEFRLevel } from '../shared/cefr.js';

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

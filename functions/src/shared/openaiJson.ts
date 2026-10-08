import { HttpsError } from 'firebase-functions/https';
import type OpenAI from 'openai' with { 'resolution-mode': 'import' };
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions' with {
  'resolution-mode': 'import',
};
import { stripMarkdownCodeFences } from './json.js';

/**
 * Runs a chat completion that must answer in JSON. `validate` should throw when the
 * parsed shape is wrong; it may also normalise the parsed value in place.
 */
export async function requestJsonCompletion<T>(
  openai: OpenAI,
  params: ChatCompletionCreateParamsNonStreaming,
  validate: (parsed: T) => void
): Promise<T> {
  const completion = await openai.chat.completions.create(params);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpsError('internal', 'No response from AI.');
  }

  try {
    const parsed = JSON.parse(stripMarkdownCodeFences(content)) as T;
    validate(parsed);
    return parsed;
  } catch {
    console.error('Failed to parse AI response:', content);
    throw new HttpsError('internal', 'Failed to parse AI response.');
  }
}

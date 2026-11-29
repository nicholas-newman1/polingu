import { HttpsError } from 'firebase-functions/https';
import type OpenAI from 'openai' with { 'resolution-mode': 'import' };
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions' with {
  'resolution-mode': 'import',
};
import { openaiApiKey } from './secrets.js';

/**
 * `temperature` is only accepted with `reasoning_effort: 'none'`. The installed SDK's
 * types predate that value, hence the cast.
 */
export const CHAT_MODEL_PARAMS = {
  model: 'gpt-6-luna',
  reasoning_effort: 'none',
} as unknown as Pick<ChatCompletionCreateParamsNonStreaming, 'model' | 'reasoning_effort'>;

export async function createOpenAI(apiKey: string): Promise<OpenAI> {
  const { default: OpenAIClient } = await import('openai');
  return new OpenAIClient({ apiKey });
}

/** A client on the configured key; callables fail with `failed-precondition` without one. */
export async function createConfiguredOpenAI(): Promise<OpenAI> {
  const apiKey = openaiApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI service is not configured.');
  }
  return createOpenAI(apiKey);
}

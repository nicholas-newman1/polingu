import type OpenAI from 'openai' with { 'resolution-mode': 'import' };

export async function createOpenAI(apiKey: string): Promise<OpenAI> {
  const { default: OpenAIClient } = await import('openai');
  return new OpenAIClient({ apiKey });
}

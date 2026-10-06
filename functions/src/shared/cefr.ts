import OpenAI from 'openai';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function isCEFRLevel(value: unknown): value is CEFRLevel {
  return typeof value === 'string' && (CEFR_LEVELS as string[]).includes(value);
}

/** Asks the model for a CEFR level; throws if the request fails. */
export async function requestCEFRLevel(openai: OpenAI, polish: string): Promise<CEFRLevel | null> {
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
  return isCEFRLevel(levelResponse) ? levelResponse : null;
}

export async function assessSentenceCEFR(
  polish: string,
  apiKey: string
): Promise<CEFRLevel | null> {
  try {
    return await requestCEFRLevel(new OpenAI({ apiKey }), polish);
  } catch (error) {
    console.error('CEFR assessment failed:', error);
    return null;
  }
}

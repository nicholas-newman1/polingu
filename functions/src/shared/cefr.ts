import OpenAI from 'openai';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function isCEFRLevel(value: unknown): value is CEFRLevel {
  return typeof value === 'string' && (CEFR_LEVELS as string[]).includes(value);
}

export async function assessSentenceCEFR(
  polish: string,
  apiKey: string
): Promise<CEFRLevel | null> {
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
    return isCEFRLevel(levelResponse) ? levelResponse : null;
  } catch (error) {
    console.error('CEFR assessment failed:', error);
    return null;
  }
}

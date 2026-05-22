import type { CustomSentence } from '../../types/sentences';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findCustomSentenceWithSamePolish(
  sentences: CustomSentence[],
  polish: string,
  excludeId?: string
): CustomSentence | undefined {
  const key = normalize(polish);
  if (!key) return undefined;
  return sentences.find((s) => s.id !== excludeId && normalize(s.polish) === key);
}

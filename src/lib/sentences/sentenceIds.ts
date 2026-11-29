import type { CEFRLevel } from '../../types/sentences';

const BUILT_IN_ID = /^([a-z][12])_(\d+)$/;

/**
 * Gives each new built-in sentence the next free id for its level, counting on from
 * the highest number among `existing` (by value, so `b1_10` beats `b1_9`).
 */
export function withNextSentenceIds<S extends { level: CEFRLevel }>(
  existing: Array<{ id: string }>,
  newSentences: S[]
): Array<S & { id: string }> {
  const highest = new Map<string, number>();
  for (const { id } of existing) {
    const match = BUILT_IN_ID.exec(id);
    if (match) highest.set(match[1], Math.max(highest.get(match[1]) ?? 0, Number(match[2])));
  }
  return newSentences.map((sentence) => {
    const level = sentence.level.toLowerCase();
    const next = (highest.get(level) ?? 0) + 1;
    highest.set(level, next);
    return { id: `${level}_${String(next).padStart(3, '0')}`, ...sentence };
  });
}

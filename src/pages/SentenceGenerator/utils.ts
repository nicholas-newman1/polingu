import type { Timestamp } from 'firebase/firestore';
import type { CEFRLevel, Sentence } from '../../types/sentences';

/** The server time a built-in sentence was saved at, or null if it has none. */
export function createdAtMillis(createdAt: unknown): number | null {
  const ts = createdAt as Timestamp | undefined;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
}

export function formatCreatedAt(createdAt: unknown): string | null {
  const millis = createdAtMillis(createdAt);
  if (millis === null) return null;
  return new Date(millis).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface CoverageStats {
  byLevel: Record<CEFRLevel, number>;
  byTag: Record<string, number>;
}

export function computeCoverageStats(sentences: Sentence[]): CoverageStats {
  const byLevel: Record<CEFRLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  };
  const byTag: Record<string, number> = {};

  for (const s of sentences) {
    byLevel[s.level]++;
    for (const tag of s.tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
  }

  return { byLevel, byTag };
}

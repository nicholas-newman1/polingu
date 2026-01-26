import { useState, useEffect } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { CEFRLevel, Sentence } from '../../types/sentences';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function formatCreatedAt(createdAt: unknown): string | null {
  if (!createdAt) return null;
  const ts = createdAt as Timestamp;
  if (typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return null;
}

export interface CoverageStats {
  byLevel: Record<CEFRLevel, number>;
  byTag: Record<string, number>;
}

export function computeCoverageStats(sentences: Sentence[]): CoverageStats {
  const byLevel: Record<CEFRLevel, number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
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


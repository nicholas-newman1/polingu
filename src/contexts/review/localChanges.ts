import { useState } from 'react';
import type { TranslationDirection } from '../../types/common';

/**
 * A load (on start-up, or a background sync) reads every store from the device,
 * then hands what it read to the providers. A change made in memory meanwhile (a
 * rating, a settings change, a reset, custom items from the live listener) is
 * missing from what the load read, so applying that would undo it on screen.
 * Changes are numbered in order; the load notes the latest number before it
 * starts, and a provider keeps its in-memory value for anything changed after.
 */
let lastChange = 0;

/** The number of the latest in-memory change, taken by a load before it reads storage. */
export function latestLocalChange(): number {
  return lastChange;
}

export interface LocalChanges {
  /** Records an in-memory change to `key`. */
  note(key: string): void;
  /** Whether `key` changed after a load that started at `readAt`, so the load's copy is stale. */
  changedSince(key: string, readAt: number | undefined): boolean;
}

export function useLocalChanges(): LocalChanges {
  const [changes] = useState<LocalChanges>(() => {
    const changedAt = new Map<string, number>();
    return {
      note: (key) => void changedAt.set(key, ++lastChange),
      changedSince: (key, readAt) => readAt !== undefined && (changedAt.get(key) ?? 0) > readAt,
    };
  });
  return changes;
}

/** `loaded`, except that each direction for which `keepCurrent` is true keeps `current`. */
export function keepDirections<T>(
  loaded: Record<TranslationDirection, T>,
  current: Record<TranslationDirection, T>,
  keepCurrent: (direction: TranslationDirection) => boolean
): Record<TranslationDirection, T> {
  const keepPlToEn = keepCurrent('pl-to-en');
  const keepEnToPl = keepCurrent('en-to-pl');
  if (!keepPlToEn && !keepEnToPl) return loaded;
  return {
    'pl-to-en': keepPlToEn ? current['pl-to-en'] : loaded['pl-to-en'],
    'en-to-pl': keepEnToPl ? current['en-to-pl'] : loaded['en-to-pl'],
  };
}

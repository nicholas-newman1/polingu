import type { TranslationDirection } from '../../types/common';

export const DIRECTION_ROUTES: Record<TranslationDirection, { route: string; label: string }> = {
  'pl-to-en': { route: 'recognition', label: 'Recognition' },
  'en-to-pl': { route: 'production', label: 'Production' },
};

export const otherDirection = (direction: TranslationDirection): TranslationDirection =>
  direction === 'pl-to-en' ? 'en-to-pl' : 'pl-to-en';

interface DirectionCounts {
  due: number;
  learned: number;
  total: number;
}

const toModeStat = (counts: DirectionCounts | undefined) => ({
  dueCount: counts?.due ?? 0,
  learnedCount: counts?.learned ?? 0,
  totalCount: counts?.total ?? 0,
});

/** Per-direction counts in the shape the mode selector cards expect. */
export const toModeStats = (
  byDirection: Partial<Record<TranslationDirection, DirectionCounts>> | undefined
) => ({
  'pl-to-en': toModeStat(byDirection?.['pl-to-en']),
  'en-to-pl': toModeStat(byDirection?.['en-to-pl']),
});

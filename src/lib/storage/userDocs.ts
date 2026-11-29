import type { AppSettings } from '../../types/appSettings';
import { DEFAULT_APP_SETTINGS } from '../../types/appSettings';
import type { UserFilters } from '../../types/userFilters';
import { DEFAULT_USER_FILTERS } from '../../types/userFilters';
import type {
  ListeningFeature,
  ListeningGapSeconds,
  ListeningHubSelections,
  ListeningOrdering,
  ListeningPlaybackGroup,
  ListeningRepetitions,
  ListeningSettings,
} from '../../types/listening';
import {
  DEFAULT_LISTENING_HUB_SELECTIONS,
  DEFAULT_LISTENING_SETTINGS,
  LISTENING_GAP_OPTIONS,
  LISTENING_REPETITION_OPTIONS,
} from '../../types/listening';
import type { TranslationDirection } from '../../types/common';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { loadUserData, saveUserData } from '../offlineDb/userDataWrapper';

/** One of the signed-in user's settings documents, kept on the device and synced to the server. */
export interface UserDoc<T> {
  defaults: T;
  /** The stored value, filled out with defaults for anything missing or invalid. */
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
}

function defineUserDoc<T>(
  path: string,
  defaults: T,
  normalize: (stored: unknown) => T
): UserDoc<T> {
  return {
    defaults,
    load: () => loadUserData(path, defaults, normalize),
    save: (value) => saveUserData(path, value),
  };
}

export const appSettingsDoc = defineUserDoc<AppSettings>(
  'appSettings',
  DEFAULT_APP_SETTINGS,
  (stored) => ({ ...DEFAULT_APP_SETTINGS, ...(stored as AppSettings) })
);

export const userFiltersDoc = defineUserDoc<UserFilters>(
  'userFilters',
  DEFAULT_USER_FILTERS,
  (stored) => {
    const filters = stored as Partial<UserFilters>;
    return {
      ...DEFAULT_USER_FILTERS,
      ...filters,
      conjugation: { ...DEFAULT_USER_FILTERS.conjugation, ...(filters.conjugation ?? {}) },
      declension: { ...DEFAULT_USER_FILTERS.declension, ...(filters.declension ?? {}) },
    };
  }
);

const VALID_ORDERINGS: ListeningOrdering[] = [
  'random',
  'due',
  'practice-ahead',
  'learned',
  'recently-added',
];

function normalizeGap(value: unknown, fallback: ListeningGapSeconds): ListeningGapSeconds {
  if (typeof value !== 'number') return fallback;
  return (LISTENING_GAP_OPTIONS as readonly number[]).includes(value)
    ? (value as ListeningGapSeconds)
    : fallback;
}

function normalizeRepetitions(
  value: unknown,
  fallback: ListeningRepetitions
): ListeningRepetitions {
  if (typeof value !== 'number') return fallback;
  return (LISTENING_REPETITION_OPTIONS as readonly number[]).includes(value)
    ? (value as ListeningRepetitions)
    : fallback;
}

function normalizeGroup(raw: unknown, fallback: ListeningPlaybackGroup): ListeningPlaybackGroup {
  const obj = (raw ?? {}) as Partial<ListeningPlaybackGroup>;
  return {
    gapBetweenCards: normalizeGap(obj.gapBetweenCards, fallback.gapBetweenCards),
    repetitions: normalizeRepetitions(obj.repetitions, fallback.repetitions),
    gapBetweenRepetitions: normalizeGap(obj.gapBetweenRepetitions, fallback.gapBetweenRepetitions),
  };
}

export const listeningSettingsDoc = defineUserDoc<ListeningSettings>(
  'listeningSettings',
  DEFAULT_LISTENING_SETTINGS,
  (stored) => {
    const obj = (stored ?? {}) as Partial<ListeningSettings>;
    const playbackRate =
      typeof obj.playbackRate === 'number' && obj.playbackRate >= 0.5 && obj.playbackRate <= 2
        ? obj.playbackRate
        : DEFAULT_LISTENING_SETTINGS.playbackRate;
    const ordering: ListeningOrdering =
      typeof obj.ordering === 'string' &&
      VALID_ORDERINGS.includes(obj.ordering as ListeningOrdering)
        ? (obj.ordering as ListeningOrdering)
        : DEFAULT_LISTENING_SETTINGS.ordering;
    return {
      playbackRate,
      ordering,
      learned: normalizeGroup(obj.learned, DEFAULT_LISTENING_SETTINGS.learned),
      unknown: normalizeGroup(obj.unknown, DEFAULT_LISTENING_SETTINGS.unknown),
    };
  }
);

const VALID_FEATURES: ListeningFeature[] = ['sentences', 'vocabulary', 'declension'];
const VALID_DIRECTIONS: TranslationDirection[] = ['en-to-pl', 'pl-to-en'];

export const listeningHubSelectionsDoc = defineUserDoc<ListeningHubSelections>(
  'listeningHubSelections',
  DEFAULT_LISTENING_HUB_SELECTIONS,
  (stored) => {
    const obj = (stored ?? {}) as Partial<ListeningHubSelections>;
    const feature =
      typeof obj.feature === 'string' && VALID_FEATURES.includes(obj.feature as ListeningFeature)
        ? (obj.feature as ListeningFeature)
        : DEFAULT_LISTENING_HUB_SELECTIONS.feature;
    const direction =
      typeof obj.direction === 'string' &&
      VALID_DIRECTIONS.includes(obj.direction as TranslationDirection)
        ? (obj.direction as TranslationDirection)
        : DEFAULT_LISTENING_HUB_SELECTIONS.direction;
    const selectedLevels = Array.isArray(obj.selectedLevels)
      ? obj.selectedLevels.filter((level): level is CEFRLevel =>
          (ALL_LEVELS as readonly string[]).includes(level as string)
        )
      : [];
    return {
      feature,
      direction,
      selectedLevels:
        selectedLevels.length > 0
          ? selectedLevels
          : [...DEFAULT_LISTENING_HUB_SELECTIONS.selectedLevels],
    };
  }
);

import type {
  ListeningSettings,
  ListeningGapSeconds,
  ListeningRepetitions,
  ListeningOrdering,
  ListeningPlaybackGroup,
} from '../../types/listening';
import {
  DEFAULT_LISTENING_SETTINGS,
  LISTENING_GAP_OPTIONS,
  LISTENING_REPETITION_OPTIONS,
} from '../../types/listening';
import { loadUserData } from '../offlineDb/userDataWrapper';

const DOC_PATH = 'listeningSettings';

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

function normalize(raw: unknown): ListeningSettings {
  const obj = (raw ?? {}) as Partial<ListeningSettings>;
  const playbackRate =
    typeof obj.playbackRate === 'number' && obj.playbackRate >= 0.5 && obj.playbackRate <= 2
      ? obj.playbackRate
      : DEFAULT_LISTENING_SETTINGS.playbackRate;
  const ordering: ListeningOrdering =
    typeof obj.ordering === 'string' && VALID_ORDERINGS.includes(obj.ordering as ListeningOrdering)
      ? (obj.ordering as ListeningOrdering)
      : DEFAULT_LISTENING_SETTINGS.ordering;
  return {
    playbackRate,
    ordering,
    learned: normalizeGroup(obj.learned, DEFAULT_LISTENING_SETTINGS.learned),
    unknown: normalizeGroup(obj.unknown, DEFAULT_LISTENING_SETTINGS.unknown),
  };
}

export async function loadListeningSettings(): Promise<ListeningSettings> {
  return loadUserData(DOC_PATH, DEFAULT_LISTENING_SETTINGS, normalize);
}

export { DOC_PATH as LISTENING_SETTINGS_DOC_PATH };

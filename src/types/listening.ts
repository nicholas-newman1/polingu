export type ListeningFeature = 'sentences' | 'vocabulary' | 'declension';

export type ListeningOrdering = 'random' | 'due' | 'practice-ahead' | 'learned' | 'recently-added';

export const LISTENING_GAP_OPTIONS = [0.5, 1, 2, 4, 8] as const;
export type ListeningGapSeconds = (typeof LISTENING_GAP_OPTIONS)[number];

export const LISTENING_REPETITION_OPTIONS = [1, 2, 3] as const;
export type ListeningRepetitions = (typeof LISTENING_REPETITION_OPTIONS)[number];

export interface ListeningPlaybackGroup {
  gapBetweenCards: ListeningGapSeconds;
  repetitions: ListeningRepetitions;
  gapBetweenRepetitions: ListeningGapSeconds;
}

export interface ListeningSettings {
  playbackRate: number;
  ordering: ListeningOrdering;
  learned: ListeningPlaybackGroup;
  unknown: ListeningPlaybackGroup;
}

export interface ListeningQueueItem {
  id: string;
  feature: ListeningFeature;
  audioUrl: string;
  primaryText: string;
  secondaryText: string;
  isLearned: boolean;
}

export interface ListeningSessionMeta {
  feature: ListeningFeature;
  title: string;
  subtitle?: string;
}

export interface ListeningHubSelections {
  feature: ListeningFeature;
  direction: 'en-to-pl' | 'pl-to-en';
  selectedLevels: ('A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2')[];
}

export const DEFAULT_LISTENING_HUB_SELECTIONS: ListeningHubSelections = {
  feature: 'sentences',
  direction: 'pl-to-en',
  selectedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
};

export const DEFAULT_LISTENING_SETTINGS: ListeningSettings = {
  playbackRate: 1,
  ordering: 'random',
  learned: {
    gapBetweenCards: 1,
    repetitions: 1,
    gapBetweenRepetitions: 1,
  },
  unknown: {
    gapBetweenCards: 2,
    repetitions: 2,
    gapBetweenRepetitions: 1,
  },
};

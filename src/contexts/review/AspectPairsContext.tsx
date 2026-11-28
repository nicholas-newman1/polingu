import { createContext, useMemo, type ReactNode } from 'react';
import type { Verb } from '../../types/conjugation';
import type {
  AspectPairCard,
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../types/aspectPairs';
import { DEFAULT_ASPECT_PAIRS_SETTINGS } from '../../types/aspectPairs';
import { aspectPairsStorage } from '../../lib/storage/reviewDeckStorage';
import { useLocalChanges } from './localChanges';
import { useSinglePartProgress } from './deckState';

export interface AspectPairsContextType {
  aspectPairCards: AspectPairCard[];
  aspectPairsReviewStore: AspectPairsReviewDataStore;
  aspectPairsSettings: AspectPairsSettings;
  updateAspectPairsReviewStore: (store: AspectPairsReviewDataStore) => Promise<void>;
  updateAspectPairsSettings: (settings: AspectPairsSettings) => Promise<void>;
  clearAspectPairsData: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AspectPairsContext = createContext<AspectPairsContextType | null>(null);

const EMPTY_VERBS: Verb[] = [];

interface AspectPairsProviderProps {
  children: ReactNode;
  verbs?: Verb[];
  initialReviewStore?: AspectPairsReviewDataStore;
  initialSettings?: AspectPairsSettings;
  /** When a load started reading this data (latestLocalChange); changes made since are kept. */
  readAt?: number;
}

/** One card per pair of verbs that name each other as their aspect pair. */
function pairUp(verbs: Verb[]): AspectPairCard[] {
  const verbsById = new Map(verbs.map((v) => [v.id, v]));
  const cards: AspectPairCard[] = [];
  const processedPairs = new Set<string>();

  for (const verb of verbs) {
    if (!verb.aspectPair) continue;

    const pairVerb = verbsById.get(verb.aspectPair);
    if (!pairVerb) continue;

    const pairKey = [verb.id, pairVerb.id].sort().join('-');
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    cards.push({ verb, pairVerb });
  }

  return cards;
}

export function AspectPairsProvider({
  children,
  verbs = EMPTY_VERBS,
  initialReviewStore,
  initialSettings = DEFAULT_ASPECT_PAIRS_SETTINGS,
  readAt,
}: AspectPairsProviderProps) {
  const localChanges = useLocalChanges();
  const progress = useSinglePartProgress(
    aspectPairsStorage,
    initialReviewStore,
    initialSettings,
    readAt,
    localChanges
  );
  const aspectPairCards = useMemo(() => pairUp(verbs), [verbs]);

  const value = useMemo<AspectPairsContextType>(
    () => ({
      aspectPairCards,
      aspectPairsReviewStore: progress.store,
      aspectPairsSettings: progress.settings,
      updateAspectPairsReviewStore: progress.updateStore,
      updateAspectPairsSettings: progress.updateSettings,
      clearAspectPairsData: progress.clear,
    }),
    [
      aspectPairCards,
      progress.store,
      progress.settings,
      progress.updateStore,
      progress.updateSettings,
      progress.clear,
    ]
  );

  return <AspectPairsContext.Provider value={value}>{children}</AspectPairsContext.Provider>;
}

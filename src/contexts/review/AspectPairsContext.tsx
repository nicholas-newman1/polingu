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
import { useDeckProgress, type DeckProgress } from './deckState';

export interface AspectPairsContextType {
  progress: DeckProgress<'all', AspectPairsReviewDataStore, AspectPairsSettings>;
  /** The pairs among the conjugation context's verbs (see pairUp). */
  cards: AspectPairCard[];
}

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
  const progress = useDeckProgress(
    aspectPairsStorage,
    { all: initialReviewStore },
    { all: initialSettings },
    readAt,
    localChanges
  );
  const cards = useMemo(() => pairUp(verbs), [verbs]);

  const value = useMemo<AspectPairsContextType>(() => ({ progress, cards }), [progress, cards]);

  return <AspectPairsContext.Provider value={value}>{children}</AspectPairsContext.Provider>;
}

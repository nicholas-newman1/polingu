import { createContext, useMemo, type ReactNode } from 'react';
import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationSettings,
  ConjugationDirectionSettings,
} from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { DEFAULT_CONJUGATION_SETTINGS } from '../../types/conjugation';
import { conjugationStorage } from '../../lib/storage/reviewDeckStorage';
import { useLocalChanges } from './localChanges';
import { useDeckProgress, useLoadedState, type DeckProgress } from './deckState';

export interface ConjugationContextType {
  progress: DeckProgress<
    TranslationDirection,
    ConjugationReviewDataStore,
    ConjugationDirectionSettings
  >;
  /** The built-in verbs; their forms (getDrillableFormsForVerb) are the deck's cards. */
  verbs: Verb[];
  setVerbs: (verbs: Verb[]) => void;
}

export const ConjugationContext = createContext<ConjugationContextType | null>(null);

interface ConjugationProviderProps {
  children: ReactNode;
  initialVerbs?: Verb[];
  initialReviewStores?: Record<TranslationDirection, ConjugationReviewDataStore>;
  initialSettings?: ConjugationSettings;
  /** When a load started reading this data (latestLocalChange); changes made since are kept. */
  readAt?: number;
}

const EMPTY_VERBS: Verb[] = [];

export function ConjugationProvider({
  children,
  initialVerbs = EMPTY_VERBS,
  initialReviewStores,
  initialSettings = DEFAULT_CONJUGATION_SETTINGS,
  readAt,
}: ConjugationProviderProps) {
  const localChanges = useLocalChanges();
  const progress = useDeckProgress(
    conjugationStorage,
    initialReviewStores,
    initialSettings,
    readAt,
    localChanges
  );
  const [verbs, setVerbs] = useLoadedState(initialVerbs);

  const value = useMemo<ConjugationContextType>(
    () => ({ progress, verbs, setVerbs }),
    [progress, verbs, setVerbs]
  );

  return <ConjugationContext.Provider value={value}>{children}</ConjugationContext.Provider>;
}

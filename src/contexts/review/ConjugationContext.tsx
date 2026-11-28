import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
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
import { useDeckProgress, useLoadedState } from './deckState';

export interface ConjugationContextType {
  verbs: Verb[];
  conjugationReviewStores: Record<TranslationDirection, ConjugationReviewDataStore>;
  conjugationSettings: ConjugationSettings;
  updateConjugationReviewStore: (
    direction: TranslationDirection,
    store: ConjugationReviewDataStore
  ) => Promise<void>;
  updateConjugationSettings: (
    direction: TranslationDirection,
    settings: ConjugationDirectionSettings
  ) => Promise<void>;
  clearConjugationReviewData: (direction: TranslationDirection) => Promise<void>;
  refreshVerbs: () => Promise<void>;
  setVerbs: (verbs: Verb[]) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
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

  const refreshVerbs = useCallback(async () => {
    const verbsSnapshot = await getDocs(collection(db, 'verbs'));
    setVerbs(verbsSnapshot.docs.map((doc) => doc.data() as Verb));
  }, [setVerbs]);

  const value = useMemo<ConjugationContextType>(
    () => ({
      verbs,
      conjugationReviewStores: progress.stores,
      conjugationSettings: progress.settings,
      updateConjugationReviewStore: progress.updateStore,
      updateConjugationSettings: progress.updateSettings,
      clearConjugationReviewData: progress.clear,
      refreshVerbs,
      setVerbs,
    }),
    [
      verbs,
      progress.stores,
      progress.settings,
      progress.updateStore,
      progress.updateSettings,
      progress.clear,
      refreshVerbs,
      setVerbs,
    ]
  );

  return <ConjugationContext.Provider value={value}>{children}</ConjugationContext.Provider>;
}

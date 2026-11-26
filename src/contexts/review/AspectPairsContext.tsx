import { createContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { Verb } from '../../types/conjugation';
import type {
  AspectPairCard,
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../types/aspectPairs';
import { DEFAULT_ASPECT_PAIRS_SETTINGS } from '../../types/aspectPairs';
import loadAspectPairsReviewData from '../../lib/storage/loadAspectPairsReviewData';
import loadAspectPairsSettings from '../../lib/storage/loadAspectPairsSettings';
import saveAspectPairsReviewData from '../../lib/storage/saveAspectPairsReviewData';
import saveAspectPairsSettings from '../../lib/storage/saveAspectPairsSettings';
import clearAspectPairsData from '../../lib/storage/clearAspectPairsData';
import { getDefaultAspectPairsReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useSyncProps } from '../../hooks/useSyncProps';
import { startDayIfNeeded } from '../../lib/reviewSession/sessionLists';
import { useLocalChanges } from './localChanges';
import { useToday } from './useToday';

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

export function AspectPairsProvider({
  children,
  verbs = EMPTY_VERBS,
  initialReviewStore,
  initialSettings = DEFAULT_ASPECT_PAIRS_SETTINGS,
  readAt,
}: AspectPairsProviderProps) {
  const [aspectPairsReviewStore, setAspectPairsReviewStore] = useState<AspectPairsReviewDataStore>(
    initialReviewStore ?? getDefaultAspectPairsReviewStore()
  );
  const storeRef = useRef(aspectPairsReviewStore);
  const [aspectPairsSettings, setAspectPairsSettings] =
    useState<AspectPairsSettings>(initialSettings);
  const localChanges = useLocalChanges();

  useSyncProps({ initialReviewStore, initialSettings }, () => {
    if (!localChanges.changedSince('reviewStore', readAt)) {
      const next = initialReviewStore ?? getDefaultAspectPairsReviewStore();
      setAspectPairsReviewStore(next);
      storeRef.current = next;
    }
    if (!localChanges.changedSince('settings', readAt)) setAspectPairsSettings(initialSettings);
  });

  const today = useToday();
  const todaysReviewStore = useMemo(
    () => startDayIfNeeded(aspectPairsReviewStore, ['reviewedToday', 'newCardsToday'], today),
    [aspectPairsReviewStore, today]
  );

  const aspectPairCards = useMemo<AspectPairCard[]>(() => {
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
  }, [verbs]);

  const updateAspectPairsReviewStore = useCallback(
    async (store: AspectPairsReviewDataStore) => {
      const prev = storeRef.current;
      storeRef.current = store;
      setAspectPairsReviewStore(store);
      localChanges.note('reviewStore');
      try {
        await saveAspectPairsReviewData(prev, store);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const updateAspectPairsSettingsFn = useCallback(
    async (settings: AspectPairsSettings) => {
      setAspectPairsSettings(settings);
      localChanges.note('settings');
      try {
        await saveAspectPairsSettings(settings);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const clearAspectPairsDataFn = useCallback(async () => {
    try {
      await clearAspectPairsData();
      const freshStore = getDefaultAspectPairsReviewStore();
      storeRef.current = freshStore;
      setAspectPairsReviewStore(freshStore);
      setAspectPairsSettings(DEFAULT_ASPECT_PAIRS_SETTINGS);
      localChanges.note('reviewStore');
      localChanges.note('settings');
    } catch (e) {
      showSaveError(e);
    }
  }, [localChanges]);

  return (
    <AspectPairsContext.Provider
      value={{
        aspectPairCards,
        aspectPairsReviewStore: todaysReviewStore,
        aspectPairsSettings,
        updateAspectPairsReviewStore,
        updateAspectPairsSettings: updateAspectPairsSettingsFn,
        clearAspectPairsData: clearAspectPairsDataFn,
      }}
    >
      {children}
    </AspectPairsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadAspectPairsData() {
  const [settings, reviewData] = await Promise.all([
    loadAspectPairsSettings(),
    loadAspectPairsReviewData(),
  ]);
  return { settings, reviewData };
}

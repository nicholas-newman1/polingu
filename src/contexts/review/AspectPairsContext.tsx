import { createContext, useState, useCallback, useMemo, type ReactNode } from 'react';
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
}

export function AspectPairsProvider({
  children,
  verbs = EMPTY_VERBS,
  initialReviewStore,
  initialSettings = DEFAULT_ASPECT_PAIRS_SETTINGS,
}: AspectPairsProviderProps) {
  const [aspectPairsReviewStore, setAspectPairsReviewStore] = useState<AspectPairsReviewDataStore>(
    initialReviewStore ?? getDefaultAspectPairsReviewStore()
  );
  const [aspectPairsSettings, setAspectPairsSettings] =
    useState<AspectPairsSettings>(initialSettings);

  useSyncProps({ initialReviewStore, initialSettings }, () => {
    setAspectPairsReviewStore(initialReviewStore ?? getDefaultAspectPairsReviewStore());
    setAspectPairsSettings(initialSettings);
  });

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

  const updateAspectPairsReviewStore = useCallback(async (store: AspectPairsReviewDataStore) => {
    setAspectPairsReviewStore(store);
    try {
      await saveAspectPairsReviewData(store);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const updateAspectPairsSettingsFn = useCallback(async (settings: AspectPairsSettings) => {
    setAspectPairsSettings(settings);
    try {
      await saveAspectPairsSettings(settings);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const clearAspectPairsDataFn = useCallback(async () => {
    try {
      await clearAspectPairsData();
      const freshStore = getDefaultAspectPairsReviewStore();
      setAspectPairsReviewStore(freshStore);
      setAspectPairsSettings(DEFAULT_ASPECT_PAIRS_SETTINGS);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  return (
    <AspectPairsContext.Provider
      value={{
        aspectPairCards,
        aspectPairsReviewStore,
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

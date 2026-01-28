import { createContext, useState, useCallback, type ReactNode } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type {
  Verb,
  ConjugationReviewDataStore,
  ConjugationSettings,
  ConjugationDirection,
  ConjugationDirectionSettings,
} from '../../types/conjugation';
import { DEFAULT_CONJUGATION_SETTINGS } from '../../types/conjugation';
import loadConjugationReviewData from '../../lib/storage/loadConjugationReviewData';
import loadConjugationSettings from '../../lib/storage/loadConjugationSettings';
import saveConjugationReviewData from '../../lib/storage/saveConjugationReviewData';
import saveConjugationSettings from '../../lib/storage/saveConjugationSettings';
import clearConjugationData from '../../lib/storage/clearConjugationData';
import { getDefaultConjugationReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';

export interface ConjugationContextType {
  verbs: Verb[];
  conjugationReviewStores: Record<ConjugationDirection, ConjugationReviewDataStore>;
  conjugationSettings: ConjugationSettings;
  updateConjugationReviewStore: (
    direction: ConjugationDirection,
    store: ConjugationReviewDataStore
  ) => Promise<void>;
  updateConjugationSettings: (
    direction: ConjugationDirection,
    settings: ConjugationDirectionSettings
  ) => Promise<void>;
  clearConjugationReviewData: (direction: ConjugationDirection) => Promise<void>;
  refreshVerbs: () => Promise<void>;
  setVerbs: (verbs: Verb[]) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ConjugationContext = createContext<ConjugationContextType | null>(null);

interface ConjugationProviderProps {
  children: ReactNode;
  initialVerbs?: Verb[];
  initialReviewStores?: Record<ConjugationDirection, ConjugationReviewDataStore>;
  initialSettings?: ConjugationSettings;
}

export function ConjugationProvider({
  children,
  initialVerbs = [],
  initialReviewStores,
  initialSettings = DEFAULT_CONJUGATION_SETTINGS,
}: ConjugationProviderProps) {
  const [verbs, setVerbs] = useState<Verb[]>(initialVerbs);
  const [conjugationReviewStores, setConjugationReviewStores] = useState<
    Record<ConjugationDirection, ConjugationReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultConjugationReviewStore(),
      'en-to-pl': getDefaultConjugationReviewStore(),
    }
  );
  const [conjugationSettings, setConjugationSettings] =
    useState<ConjugationSettings>(initialSettings);

  const updateConjugationReviewStore = useCallback(
    async (direction: ConjugationDirection, store: ConjugationReviewDataStore) => {
      setConjugationReviewStores((prev) => ({
        ...prev,
        [direction]: store,
      }));
      try {
        await saveConjugationReviewData(store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const updateConjugationSettingsFn = useCallback(
    async (direction: ConjugationDirection, settings: ConjugationDirectionSettings) => {
      setConjugationSettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      try {
        await saveConjugationSettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const clearConjugationReviewDataFn = useCallback(async (direction: ConjugationDirection) => {
    try {
      await clearConjugationData(direction);
      const freshStore = getDefaultConjugationReviewStore();
      setConjugationReviewStores((prev) => ({
        ...prev,
        [direction]: freshStore,
      }));
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const refreshVerbs = useCallback(async () => {
    const verbsSnapshot = await getDocs(collection(db, 'verbs'));
    const loadedVerbs = verbsSnapshot.docs.map((doc) => doc.data() as Verb);
    setVerbs(loadedVerbs);
  }, []);

  return (
    <ConjugationContext.Provider
      value={{
        verbs,
        conjugationReviewStores,
        conjugationSettings,
        updateConjugationReviewStore,
        updateConjugationSettings: updateConjugationSettingsFn,
        clearConjugationReviewData: clearConjugationReviewDataFn,
        refreshVerbs,
        setVerbs,
      }}
    >
      {children}
    </ConjugationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadConjugationData() {
  const [settings, plToEnStore, enToPlStore] = await Promise.all([
    loadConjugationSettings(),
    loadConjugationReviewData('pl-to-en'),
    loadConjugationReviewData('en-to-pl'),
  ]);
  return {
    settings,
    reviewStores: {
      'pl-to-en': plToEnStore,
      'en-to-pl': enToPlStore,
    },
  };
}

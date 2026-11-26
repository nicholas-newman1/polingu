import { createContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
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
import loadConjugationReviewData from '../../lib/storage/loadConjugationReviewData';
import loadConjugationSettings from '../../lib/storage/loadConjugationSettings';
import saveConjugationReviewData from '../../lib/storage/saveConjugationReviewData';
import saveConjugationSettings from '../../lib/storage/saveConjugationSettings';
import clearConjugationData from '../../lib/storage/clearConjugationData';
import { getDefaultConjugationReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useSyncProps } from '../../hooks/useSyncProps';
import { startDayInBothDirections } from '../../lib/reviewSession/sessionLists';
import { keepDirections, useLocalChanges } from './localChanges';
import { useToday } from './useToday';

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
  const [verbs, setVerbs] = useState<Verb[]>(initialVerbs);
  const [conjugationReviewStores, setConjugationReviewStores] = useState<
    Record<TranslationDirection, ConjugationReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultConjugationReviewStore(),
      'en-to-pl': getDefaultConjugationReviewStore(),
    }
  );
  const storesRef = useRef(conjugationReviewStores);
  const [conjugationSettings, setConjugationSettings] =
    useState<ConjugationSettings>(initialSettings);
  const localChanges = useLocalChanges();

  useSyncProps({ initialVerbs, initialReviewStores, initialSettings }, () => {
    setVerbs(initialVerbs);
    const loadedStores = initialReviewStores ?? {
      'pl-to-en': getDefaultConjugationReviewStore(),
      'en-to-pl': getDefaultConjugationReviewStore(),
    };
    const nextStores = keepDirections(loadedStores, storesRef.current, (d) =>
      localChanges.changedSince(`reviewStore:${d}`, readAt)
    );
    setConjugationReviewStores(nextStores);
    storesRef.current = nextStores;
    setConjugationSettings((current) =>
      keepDirections(initialSettings, current, (d) =>
        localChanges.changedSince(`settings:${d}`, readAt)
      )
    );
  });

  const today = useToday();
  const todaysReviewStores = useMemo(
    () =>
      startDayInBothDirections(conjugationReviewStores, ['reviewedToday', 'newFormsToday'], today),
    [conjugationReviewStores, today]
  );

  const updateConjugationReviewStore = useCallback(
    async (direction: TranslationDirection, store: ConjugationReviewDataStore) => {
      const prevStore = storesRef.current[direction];
      const nextAll = { ...storesRef.current, [direction]: store };
      storesRef.current = nextAll;
      setConjugationReviewStores(nextAll);
      localChanges.note(`reviewStore:${direction}`);
      try {
        await saveConjugationReviewData(prevStore, store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const updateConjugationSettingsFn = useCallback(
    async (direction: TranslationDirection, settings: ConjugationDirectionSettings) => {
      setConjugationSettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      localChanges.note(`settings:${direction}`);
      try {
        await saveConjugationSettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const clearConjugationReviewDataFn = useCallback(
    async (direction: TranslationDirection) => {
      try {
        await clearConjugationData(direction);
        const freshStore = getDefaultConjugationReviewStore();
        const nextAll = { ...storesRef.current, [direction]: freshStore };
        storesRef.current = nextAll;
        setConjugationReviewStores(nextAll);
        // The reset deletes this direction's settings too, so a reload would load the defaults.
        setConjugationSettings((prev) => ({
          ...prev,
          [direction]: DEFAULT_CONJUGATION_SETTINGS[direction],
        }));
        localChanges.note(`reviewStore:${direction}`);
        localChanges.note(`settings:${direction}`);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const refreshVerbs = useCallback(async () => {
    const verbsSnapshot = await getDocs(collection(db, 'verbs'));
    const loadedVerbs = verbsSnapshot.docs.map((doc) => doc.data() as Verb);
    setVerbs(loadedVerbs);
  }, []);

  return (
    <ConjugationContext.Provider
      value={{
        verbs,
        conjugationReviewStores: todaysReviewStores,
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

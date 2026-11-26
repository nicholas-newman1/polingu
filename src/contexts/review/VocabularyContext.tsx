import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyDirectionSettings,
  CustomVocabularyWord,
} from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import loadVocabularyReviewData from '../../lib/storage/loadVocabularyReviewData';
import loadVocabularySettings, {
  DEFAULT_VOCABULARY_SETTINGS,
} from '../../lib/storage/loadVocabularySettings';
import saveVocabularyReviewData from '../../lib/storage/saveVocabularyReviewData';
import saveVocabularySettings from '../../lib/storage/saveVocabularySettings';
import {
  loadCustomVocabulary,
  subscribeCustomVocabulary,
} from '../../lib/storage/customVocabulary';
import { useAuthContext } from '../../hooks/useAuthContext';
import clearVocabularyData from '../../lib/storage/clearVocabularyData';
import { getDefaultVocabularyReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useSyncProps } from '../../hooks/useSyncProps';
import { startDayInBothDirections } from '../../lib/reviewSession/sessionLists';
import { keepDirections, useLocalChanges } from './localChanges';
import { useToday } from './useToday';

export interface VocabularyContextType {
  vocabularyReviewStores: Record<TranslationDirection, VocabularyReviewDataStore>;
  vocabularySettings: VocabularySettings;
  vocabularyWords: VocabularyWord[];
  customWords: CustomVocabularyWord[];
  systemWords: VocabularyWord[];
  updateVocabularyReviewStore: (
    direction: TranslationDirection,
    store: VocabularyReviewDataStore
  ) => Promise<void>;
  updateVocabularySettings: (
    direction: TranslationDirection,
    settings: VocabularyDirectionSettings
  ) => Promise<void>;
  clearVocabularyReviewData: (direction: TranslationDirection) => Promise<void>;
  refreshVocabularyWords: () => Promise<void>;
  setCustomWords: (words: CustomVocabularyWord[]) => void;
  setSystemWords: (words: VocabularyWord[]) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const VocabularyContext = createContext<VocabularyContextType | null>(null);

interface VocabularyProviderProps {
  children: ReactNode;
  initialCustomWords?: CustomVocabularyWord[];
  initialSystemWords?: VocabularyWord[];
  initialReviewStores?: Record<TranslationDirection, VocabularyReviewDataStore>;
  initialSettings?: VocabularySettings;
  /** When a load started reading this data (latestLocalChange); changes made since are kept. */
  readAt?: number;
}

const EMPTY_CUSTOM_WORDS: CustomVocabularyWord[] = [];
const EMPTY_SYSTEM_WORDS: VocabularyWord[] = [];

export function VocabularyProvider({
  children,
  initialCustomWords = EMPTY_CUSTOM_WORDS,
  initialSystemWords = EMPTY_SYSTEM_WORDS,
  initialReviewStores,
  initialSettings = DEFAULT_VOCABULARY_SETTINGS,
  readAt,
}: VocabularyProviderProps) {
  const [vocabularyReviewStores, setVocabularyReviewStores] = useState<
    Record<TranslationDirection, VocabularyReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultVocabularyReviewStore(),
      'en-to-pl': getDefaultVocabularyReviewStore(),
    }
  );
  const storesRef = useRef(vocabularyReviewStores);
  const [vocabularySettings, setVocabularySettings] = useState<VocabularySettings>(initialSettings);
  const [customWords, setCustomWordsState] = useState<CustomVocabularyWord[]>(initialCustomWords);
  const [systemWords, setSystemWords] = useState<VocabularyWord[]>(initialSystemWords);
  const localChanges = useLocalChanges();

  useSyncProps(
    { initialReviewStores, initialSettings, initialCustomWords, initialSystemWords },
    () => {
      const loadedStores = initialReviewStores ?? {
        'pl-to-en': getDefaultVocabularyReviewStore(),
        'en-to-pl': getDefaultVocabularyReviewStore(),
      };
      const nextStores = keepDirections(loadedStores, storesRef.current, (d) =>
        localChanges.changedSince(`reviewStore:${d}`, readAt)
      );
      setVocabularyReviewStores(nextStores);
      storesRef.current = nextStores;
      setVocabularySettings((current) =>
        keepDirections(initialSettings, current, (d) =>
          localChanges.changedSince(`settings:${d}`, readAt)
        )
      );
      if (!localChanges.changedSince('customItems', readAt))
        setCustomWordsState(initialCustomWords);
      setSystemWords(initialSystemWords);
    }
  );

  const today = useToday();
  const todaysReviewStores = useMemo(
    () =>
      startDayInBothDirections(vocabularyReviewStores, ['reviewedToday', 'newCardsToday'], today),
    [vocabularyReviewStores, today]
  );

  const vocabularyWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  // Listener snapshots and page edits; a load that read the list before them must not undo them.
  const setCustomWords = useCallback(
    (words: CustomVocabularyWord[]) => {
      setCustomWordsState(words);
      localChanges.note('customItems');
    },
    [localChanges]
  );

  const { user } = useAuthContext();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsub = subscribeCustomVocabulary((items) => {
      // Dropped if the listener closed (sign-out or account switch) while it was being handled.
      if (active) setCustomWords(items);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user, setCustomWords]);

  const updateVocabularyReviewStore = useCallback(
    async (direction: TranslationDirection, store: VocabularyReviewDataStore) => {
      const prevStore = storesRef.current[direction];
      const nextAll = { ...storesRef.current, [direction]: store };
      storesRef.current = nextAll;
      setVocabularyReviewStores(nextAll);
      localChanges.note(`reviewStore:${direction}`);
      try {
        await saveVocabularyReviewData(prevStore, store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const updateVocabularySettingsFn = useCallback(
    async (direction: TranslationDirection, settings: VocabularyDirectionSettings) => {
      setVocabularySettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      localChanges.note(`settings:${direction}`);
      try {
        await saveVocabularySettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const clearVocabularyReviewDataFn = useCallback(
    async (direction: TranslationDirection) => {
      try {
        await clearVocabularyData(direction);
        const freshStore = getDefaultVocabularyReviewStore();
        const nextAll = { ...storesRef.current, [direction]: freshStore };
        storesRef.current = nextAll;
        setVocabularyReviewStores(nextAll);
        localChanges.note(`reviewStore:${direction}`);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const refreshVocabularyWords = useCallback(async () => {
    const [loadedCustomWords, vocabularySnapshot] = await Promise.all([
      loadCustomVocabulary(),
      getDocs(collection(db, 'vocabulary')),
    ]);
    const loadedSystemWords = vocabularySnapshot.docs.map((doc) => doc.data() as VocabularyWord);
    setCustomWords(loadedCustomWords);
    setSystemWords(loadedSystemWords);
  }, [setCustomWords]);

  return (
    <VocabularyContext.Provider
      value={{
        vocabularyReviewStores: todaysReviewStores,
        vocabularySettings,
        vocabularyWords,
        customWords,
        systemWords,
        updateVocabularyReviewStore,
        updateVocabularySettings: updateVocabularySettingsFn,
        clearVocabularyReviewData: clearVocabularyReviewDataFn,
        refreshVocabularyWords,
        setCustomWords,
        setSystemWords,
      }}
    >
      {children}
    </VocabularyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadVocabularyData() {
  const [settings, customWords, plToEnStore, enToPlStore] = await Promise.all([
    loadVocabularySettings(),
    loadCustomVocabulary(),
    loadVocabularyReviewData('pl-to-en'),
    loadVocabularyReviewData('en-to-pl'),
  ]);
  return {
    settings,
    customWords,
    reviewStores: {
      'pl-to-en': plToEnStore,
      'en-to-pl': enToPlStore,
    },
  };
}

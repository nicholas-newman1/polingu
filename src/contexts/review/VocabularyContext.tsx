import { createContext, useState, useCallback, useMemo, type ReactNode } from 'react';
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
import { loadCustomVocabulary } from '../../lib/storage/customVocabulary';
import clearVocabularyData from '../../lib/storage/clearVocabularyData';
import { getDefaultVocabularyReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useSyncProps } from '../../hooks/useSyncProps';

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
}

const EMPTY_CUSTOM_WORDS: CustomVocabularyWord[] = [];
const EMPTY_SYSTEM_WORDS: VocabularyWord[] = [];

export function VocabularyProvider({
  children,
  initialCustomWords = EMPTY_CUSTOM_WORDS,
  initialSystemWords = EMPTY_SYSTEM_WORDS,
  initialReviewStores,
  initialSettings = DEFAULT_VOCABULARY_SETTINGS,
}: VocabularyProviderProps) {
  const [vocabularyReviewStores, setVocabularyReviewStores] = useState<
    Record<TranslationDirection, VocabularyReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultVocabularyReviewStore(),
      'en-to-pl': getDefaultVocabularyReviewStore(),
    }
  );
  const [vocabularySettings, setVocabularySettings] = useState<VocabularySettings>(initialSettings);
  const [customWords, setCustomWords] = useState<CustomVocabularyWord[]>(initialCustomWords);
  const [systemWords, setSystemWords] = useState<VocabularyWord[]>(initialSystemWords);

  useSyncProps(
    { initialReviewStores, initialSettings, initialCustomWords, initialSystemWords },
    () => {
      setVocabularyReviewStores(
        initialReviewStores ?? {
          'pl-to-en': getDefaultVocabularyReviewStore(),
          'en-to-pl': getDefaultVocabularyReviewStore(),
        }
      );
      setVocabularySettings(initialSettings);
      setCustomWords(initialCustomWords);
      setSystemWords(initialSystemWords);
    }
  );

  const vocabularyWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  const updateVocabularyReviewStore = useCallback(
    async (direction: TranslationDirection, store: VocabularyReviewDataStore) => {
      setVocabularyReviewStores((prev) => ({
        ...prev,
        [direction]: store,
      }));
      try {
        await saveVocabularyReviewData(store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const updateVocabularySettingsFn = useCallback(
    async (direction: TranslationDirection, settings: VocabularyDirectionSettings) => {
      setVocabularySettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      try {
        await saveVocabularySettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const clearVocabularyReviewDataFn = useCallback(async (direction: TranslationDirection) => {
    try {
      await clearVocabularyData(direction);
      const freshStore = getDefaultVocabularyReviewStore();
      setVocabularyReviewStores((prev) => ({
        ...prev,
        [direction]: freshStore,
      }));
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const refreshVocabularyWords = useCallback(async () => {
    const [loadedCustomWords, vocabularySnapshot] = await Promise.all([
      loadCustomVocabulary(),
      getDocs(collection(db, 'vocabulary')),
    ]);
    const loadedSystemWords = vocabularySnapshot.docs.map((doc) => doc.data() as VocabularyWord);
    setCustomWords(loadedCustomWords);
    setSystemWords(loadedSystemWords);
  }, []);

  return (
    <VocabularyContext.Provider
      value={{
        vocabularyReviewStores,
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

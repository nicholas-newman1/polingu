import { createContext, useCallback, useMemo, type ReactNode } from 'react';
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
import { DEFAULT_VOCABULARY_SETTINGS } from '../../types/vocabulary';
import {
  loadCustomVocabulary,
  subscribeCustomVocabulary,
} from '../../lib/storage/customVocabulary';
import { vocabularyStorage } from '../../lib/storage/reviewDeckStorage';
import { useLocalChanges } from './localChanges';
import { useCustomItems, useDeckProgress, useLoadedState } from './deckState';

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
  const localChanges = useLocalChanges();
  const progress = useDeckProgress(
    vocabularyStorage,
    initialReviewStores,
    initialSettings,
    readAt,
    localChanges
  );
  const [customWords, setCustomWords] = useCustomItems(
    initialCustomWords,
    subscribeCustomVocabulary,
    readAt,
    localChanges
  );
  const [systemWords, setSystemWords] = useLoadedState(initialSystemWords);

  const vocabularyWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  const refreshVocabularyWords = useCallback(async () => {
    const [loadedCustomWords, vocabularySnapshot] = await Promise.all([
      loadCustomVocabulary(),
      getDocs(collection(db, 'vocabulary')),
    ]);
    setCustomWords(loadedCustomWords);
    setSystemWords(vocabularySnapshot.docs.map((doc) => doc.data() as VocabularyWord));
  }, [setCustomWords, setSystemWords]);

  const value = useMemo<VocabularyContextType>(
    () => ({
      vocabularyReviewStores: progress.stores,
      vocabularySettings: progress.settings,
      vocabularyWords,
      customWords,
      systemWords,
      updateVocabularyReviewStore: progress.updateStore,
      updateVocabularySettings: progress.updateSettings,
      clearVocabularyReviewData: progress.clear,
      refreshVocabularyWords,
      setCustomWords,
      setSystemWords,
    }),
    [
      progress.stores,
      progress.settings,
      progress.updateStore,
      progress.updateSettings,
      progress.clear,
      vocabularyWords,
      customWords,
      systemWords,
      refreshVocabularyWords,
      setCustomWords,
      setSystemWords,
    ]
  );

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

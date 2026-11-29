import { createContext, useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyDirectionSettings,
  CustomVocabularyWord,
} from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { DEFAULT_VOCABULARY_SETTINGS } from '../../types/vocabulary';
import { subscribeCustomVocabulary } from '../../lib/storage/customVocabulary';
import { vocabularyStorage } from '../../lib/storage/reviewDeckStorage';
import { useLocalChanges } from './localChanges';
import { useCustomItems, useDeckProgress, useLoadedState, type DeckProgress } from './deckState';

export interface VocabularyContextType {
  progress: DeckProgress<
    TranslationDirection,
    VocabularyReviewDataStore,
    VocabularyDirectionSettings
  >;
  /** The learner's words first, then the built-in ones. */
  words: VocabularyWord[];
  customWords: CustomVocabularyWord[];
  systemWords: VocabularyWord[];
  setCustomWords: Dispatch<SetStateAction<CustomVocabularyWord[]>>;
  setSystemWords: (words: VocabularyWord[]) => void;
}

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

  const words = useMemo(() => [...customWords, ...systemWords], [customWords, systemWords]);

  const value = useMemo<VocabularyContextType>(
    () => ({ progress, words, customWords, systemWords, setCustomWords, setSystemWords }),
    [progress, words, customWords, systemWords, setCustomWords, setSystemWords]
  );

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

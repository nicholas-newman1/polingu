import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import type {
  Sentence,
  CustomSentence,
  SentenceReviewDataStore,
  SentenceSettings,
  SentenceDirectionSettings,
  TagCategory,
} from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { DEFAULT_SENTENCE_SETTINGS } from '../../types/sentences';
import {
  saveSentenceTags,
  DEFAULT_TAGS,
  type SentenceTagsData,
} from '../../lib/storage/sentenceTags';
import { subscribeCustomSentences } from '../../lib/storage/customSentences';
import { sentenceStorage } from '../../lib/storage/reviewDeckStorage';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useLocalChanges } from './localChanges';
import { useCustomItems, useDeckProgress, useLoadedState } from './deckState';

export interface SentenceContextType {
  sentenceReviewStores: Record<TranslationDirection, SentenceReviewDataStore>;
  sentenceSettings: SentenceSettings;
  sentences: Sentence[];
  customSentences: CustomSentence[];
  systemSentences: Sentence[];
  sentenceTags: SentenceTagsData;
  updateSentenceReviewStore: (
    direction: TranslationDirection,
    store: SentenceReviewDataStore
  ) => Promise<void>;
  updateSentenceSettings: (
    direction: TranslationDirection,
    settings: SentenceDirectionSettings
  ) => Promise<void>;
  clearSentenceReviewData: (direction: TranslationDirection) => Promise<void>;
  setSentences: (sentences: Sentence[]) => void;
  setCustomSentences: (sentences: CustomSentence[]) => void;
  setSystemSentences: (sentences: Sentence[]) => void;
  addSentenceTag: (category: TagCategory, tag: string) => Promise<void>;
  removeSentenceTag: (category: TagCategory, tag: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SentenceContext = createContext<SentenceContextType | null>(null);

interface SentenceProviderProps {
  children: ReactNode;
  initialCustomSentences?: CustomSentence[];
  initialSystemSentences?: Sentence[];
  initialReviewStores?: Record<TranslationDirection, SentenceReviewDataStore>;
  initialSettings?: SentenceSettings;
  initialTags?: SentenceTagsData;
  /** When a load started reading this data (latestLocalChange); changes made since are kept. */
  readAt?: number;
}

const EMPTY_CUSTOM_SENTENCES: CustomSentence[] = [];
const EMPTY_SYSTEM_SENTENCES: Sentence[] = [];

export function SentenceProvider({
  children,
  initialCustomSentences = EMPTY_CUSTOM_SENTENCES,
  initialSystemSentences = EMPTY_SYSTEM_SENTENCES,
  initialReviewStores,
  initialSettings = DEFAULT_SENTENCE_SETTINGS,
  initialTags = DEFAULT_TAGS,
  readAt,
}: SentenceProviderProps) {
  const localChanges = useLocalChanges();
  const progress = useDeckProgress(
    sentenceStorage,
    initialReviewStores,
    initialSettings,
    readAt,
    localChanges
  );
  const [customSentences, setCustomSentences] = useCustomItems(
    initialCustomSentences,
    subscribeCustomSentences,
    readAt,
    localChanges
  );
  const [systemSentences, setSystemSentences] = useLoadedState(initialSystemSentences);
  const [sentenceTags, setSentenceTags] = useLoadedState(initialTags);

  const sentences = useMemo<Sentence[]>(
    () => [...customSentences, ...systemSentences],
    [customSentences, systemSentences]
  );

  // Callers pass back the whole list (custom + built-in); custom sentences have their own state.
  const setSentences = useCallback(
    (all: Sentence[]) => setSystemSentences(all.filter((sentence) => !sentence.isCustom)),
    [setSystemSentences]
  );

  const saveTags = useCallback(
    async (tags: SentenceTagsData) => {
      setSentenceTags(tags);
      try {
        await saveSentenceTags(tags);
      } catch (e) {
        showSaveError(e);
      }
    },
    [setSentenceTags]
  );

  const addSentenceTag = useCallback(
    async (category: TagCategory, tag: string) => {
      if (sentenceTags[category].includes(tag)) return;
      await saveTags({ ...sentenceTags, [category]: [...sentenceTags[category], tag] });
    },
    [sentenceTags, saveTags]
  );

  const removeSentenceTag = useCallback(
    async (category: TagCategory, tag: string) => {
      await saveTags({
        ...sentenceTags,
        [category]: sentenceTags[category].filter((t) => t !== tag),
      });
    },
    [sentenceTags, saveTags]
  );

  const value = useMemo<SentenceContextType>(
    () => ({
      sentenceReviewStores: progress.stores,
      sentenceSettings: progress.settings,
      sentences,
      customSentences,
      systemSentences,
      sentenceTags,
      updateSentenceReviewStore: progress.updateStore,
      updateSentenceSettings: progress.updateSettings,
      clearSentenceReviewData: progress.clear,
      setSentences,
      setCustomSentences,
      setSystemSentences,
      addSentenceTag,
      removeSentenceTag,
    }),
    [
      progress.stores,
      progress.settings,
      progress.updateStore,
      progress.updateSettings,
      progress.clear,
      sentences,
      customSentences,
      systemSentences,
      sentenceTags,
      setSentences,
      setCustomSentences,
      setSystemSentences,
      addSentenceTag,
      removeSentenceTag,
    ]
  );

  return <SentenceContext.Provider value={value}>{children}</SentenceContext.Provider>;
}

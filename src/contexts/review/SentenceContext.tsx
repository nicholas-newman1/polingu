import {
  createContext,
  useCallback,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import { useSaveError } from '../../hooks/useSaveError';
import { useLocalChanges } from './localChanges';
import { useCustomItems, useDeckProgress, useLoadedState, type DeckProgress } from './deckState';

export interface SentenceContextType {
  progress: DeckProgress<TranslationDirection, SentenceReviewDataStore, SentenceDirectionSettings>;
  /** The learner's sentences first, then the built-in ones. */
  sentences: Sentence[];
  customSentences: CustomSentence[];
  systemSentences: Sentence[];
  /** Takes the whole list back (custom and built-in) and keeps its built-in sentences. */
  setSentences: (sentences: Sentence[]) => void;
  setCustomSentences: Dispatch<SetStateAction<CustomSentence[]>>;
  setSystemSentences: (sentences: Sentence[]) => void;
  tags: SentenceTagsData;
  addTag: (category: TagCategory, tag: string) => Promise<void>;
}

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
  const [tags, setTags] = useLoadedState(initialTags);
  const showSaveError = useSaveError();

  const sentences = useMemo(
    () => [...customSentences, ...systemSentences],
    [customSentences, systemSentences]
  );

  const setSentences = useCallback(
    (all: Sentence[]) => setSystemSentences(all.filter((sentence) => !sentence.isCustom)),
    [setSystemSentences]
  );

  const addTag = useCallback(
    async (category: TagCategory, tag: string) => {
      if (tags[category].includes(tag)) return;
      const next = { ...tags, [category]: [...tags[category], tag] };
      setTags(next);
      try {
        await saveSentenceTags(next);
      } catch (e) {
        showSaveError(e);
      }
    },
    [tags, setTags, showSaveError]
  );

  const value = useMemo<SentenceContextType>(
    () => ({
      progress,
      sentences,
      customSentences,
      systemSentences,
      setSentences,
      setCustomSentences,
      setSystemSentences,
      tags,
      addTag,
    }),
    [
      progress,
      sentences,
      customSentences,
      systemSentences,
      setSentences,
      setCustomSentences,
      setSystemSentences,
      tags,
      addTag,
    ]
  );

  return <SentenceContext.Provider value={value}>{children}</SentenceContext.Provider>;
}

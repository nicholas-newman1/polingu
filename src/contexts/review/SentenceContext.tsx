import { createContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type {
  Sentence,
  CustomSentence,
  SentenceReviewDataStore,
  SentenceSettings,
  SentenceDirection,
  SentenceDirectionSettings,
  TagCategory,
} from '../../types/sentences';
import {
  loadSentenceTags,
  saveSentenceTags,
  DEFAULT_TAGS,
  type SentenceTagsData,
} from '../../lib/storage/sentenceTags';
import loadSentenceReviewData from '../../lib/storage/loadSentenceReviewData';
import loadSentenceSettings, {
  DEFAULT_SENTENCE_SETTINGS,
} from '../../lib/storage/loadSentenceSettings';
import saveSentenceReviewData from '../../lib/storage/saveSentenceReviewData';
import saveSentenceSettings from '../../lib/storage/saveSentenceSettings';
import { loadCustomSentences } from '../../lib/storage/customSentences';
import clearSentenceData from '../../lib/storage/clearSentenceData';
import { getDefaultSentenceReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';

export interface SentenceContextType {
  sentenceReviewStores: Record<SentenceDirection, SentenceReviewDataStore>;
  sentenceSettings: SentenceSettings;
  sentences: Sentence[];
  customSentences: CustomSentence[];
  systemSentences: Sentence[];
  sentenceTags: SentenceTagsData;
  updateSentenceReviewStore: (
    direction: SentenceDirection,
    store: SentenceReviewDataStore
  ) => Promise<void>;
  updateSentenceSettings: (
    direction: SentenceDirection,
    settings: SentenceDirectionSettings
  ) => Promise<void>;
  clearSentenceReviewData: (direction: SentenceDirection) => Promise<void>;
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
  initialReviewStores?: Record<SentenceDirection, SentenceReviewDataStore>;
  initialSettings?: SentenceSettings;
  initialTags?: SentenceTagsData;
}

export function SentenceProvider({
  children,
  initialCustomSentences = [],
  initialSystemSentences = [],
  initialReviewStores,
  initialSettings = DEFAULT_SENTENCE_SETTINGS,
  initialTags = DEFAULT_TAGS,
}: SentenceProviderProps) {
  const [sentenceReviewStores, setSentenceReviewStores] = useState<
    Record<SentenceDirection, SentenceReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultSentenceReviewStore(),
      'en-to-pl': getDefaultSentenceReviewStore(),
    }
  );
  const [sentenceSettings, setSentenceSettings] = useState<SentenceSettings>(initialSettings);
  const [customSentences, setCustomSentences] = useState<CustomSentence[]>(initialCustomSentences);
  const [systemSentences, setSystemSentences] = useState<Sentence[]>(initialSystemSentences);
  const [sentenceTags, setSentenceTags] = useState<SentenceTagsData>(initialTags);

  const sentences = useMemo<Sentence[]>(
    () => [...customSentences, ...systemSentences],
    [customSentences, systemSentences]
  );

  const updateSentenceReviewStore = useCallback(
    async (direction: SentenceDirection, store: SentenceReviewDataStore) => {
      setSentenceReviewStores((prev) => ({
        ...prev,
        [direction]: store,
      }));
      try {
        await saveSentenceReviewData(store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const updateSentenceSettingsFn = useCallback(
    async (direction: SentenceDirection, settings: SentenceDirectionSettings) => {
      setSentenceSettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      try {
        await saveSentenceSettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const clearSentenceReviewDataFn = useCallback(async (direction: SentenceDirection) => {
    try {
      await clearSentenceData(direction);
      const freshStore = getDefaultSentenceReviewStore();
      setSentenceReviewStores((prev) => ({
        ...prev,
        [direction]: freshStore,
      }));
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const addSentenceTag = useCallback(
    async (category: TagCategory, tag: string) => {
      const newTags = { ...sentenceTags };
      if (!newTags[category].includes(tag)) {
        newTags[category] = [...newTags[category], tag];
        setSentenceTags(newTags);
        try {
          await saveSentenceTags(newTags);
        } catch (e) {
          showSaveError(e);
        }
      }
    },
    [sentenceTags]
  );

  const removeSentenceTag = useCallback(
    async (category: TagCategory, tag: string) => {
      const newTags = { ...sentenceTags };
      newTags[category] = newTags[category].filter((t) => t !== tag);
      setSentenceTags(newTags);
      try {
        await saveSentenceTags(newTags);
      } catch (e) {
        showSaveError(e);
      }
    },
    [sentenceTags]
  );

  return (
    <SentenceContext.Provider
      value={{
        sentenceReviewStores,
        sentenceSettings,
        sentences,
        customSentences,
        systemSentences,
        sentenceTags,
        updateSentenceReviewStore,
        updateSentenceSettings: updateSentenceSettingsFn,
        clearSentenceReviewData: clearSentenceReviewDataFn,
        setSentences: setSystemSentences,
        setCustomSentences,
        setSystemSentences,
        addSentenceTag,
        removeSentenceTag,
      }}
    >
      {children}
    </SentenceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadSentenceData() {
  const [settings, customSentences, tags, plToEnStore, enToPlStore] = await Promise.all([
    loadSentenceSettings(),
    loadCustomSentences(),
    loadSentenceTags(),
    loadSentenceReviewData('pl-to-en'),
    loadSentenceReviewData('en-to-pl'),
  ]);
  return {
    settings,
    customSentences,
    tags,
    reviewStores: {
      'pl-to-en': plToEnStore,
      'en-to-pl': enToPlStore,
    },
  };
}

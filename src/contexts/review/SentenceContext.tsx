import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
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
import { loadCustomSentences, subscribeCustomSentences } from '../../lib/storage/customSentences';
import { useAuthContext } from '../../hooks/useAuthContext';
import clearSentenceData from '../../lib/storage/clearSentenceData';
import { getDefaultSentenceReviewStore } from '../../lib/storage/helpers';
import { showSaveError } from '../../lib/storage/errorHandler';
import { useSyncProps } from '../../hooks/useSyncProps';
import { startDayInBothDirections } from '../../lib/reviewSession/sessionLists';
import { keepDirections, useLocalChanges } from './localChanges';
import { useToday } from './useToday';

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
  const [sentenceReviewStores, setSentenceReviewStores] = useState<
    Record<TranslationDirection, SentenceReviewDataStore>
  >(
    initialReviewStores ?? {
      'pl-to-en': getDefaultSentenceReviewStore(),
      'en-to-pl': getDefaultSentenceReviewStore(),
    }
  );
  const storesRef = useRef(sentenceReviewStores);
  const [sentenceSettings, setSentenceSettings] = useState<SentenceSettings>(initialSettings);
  const [customSentences, setCustomSentencesState] =
    useState<CustomSentence[]>(initialCustomSentences);
  const [systemSentences, setSystemSentences] = useState<Sentence[]>(initialSystemSentences);
  const [sentenceTags, setSentenceTags] = useState<SentenceTagsData>(initialTags);
  const localChanges = useLocalChanges();

  useSyncProps(
    {
      initialReviewStores,
      initialSettings,
      initialCustomSentences,
      initialSystemSentences,
      initialTags,
    },
    () => {
      const loadedStores = initialReviewStores ?? {
        'pl-to-en': getDefaultSentenceReviewStore(),
        'en-to-pl': getDefaultSentenceReviewStore(),
      };
      const nextStores = keepDirections(loadedStores, storesRef.current, (d) =>
        localChanges.changedSince(`reviewStore:${d}`, readAt)
      );
      setSentenceReviewStores(nextStores);
      storesRef.current = nextStores;
      setSentenceSettings((current) =>
        keepDirections(initialSettings, current, (d) =>
          localChanges.changedSince(`settings:${d}`, readAt)
        )
      );
      if (!localChanges.changedSince('customItems', readAt)) {
        setCustomSentencesState(initialCustomSentences);
      }
      setSystemSentences(initialSystemSentences);
      setSentenceTags(initialTags);
    }
  );

  const sentences = useMemo<Sentence[]>(
    () => [...customSentences, ...systemSentences],
    [customSentences, systemSentences]
  );

  // Callers pass back the whole list (custom + built-in); custom sentences have their own state.
  const setSentences = useCallback((all: Sentence[]) => {
    setSystemSentences(all.filter((sentence) => !sentence.isCustom));
  }, []);

  const today = useToday();
  const todaysReviewStores = useMemo(
    () => startDayInBothDirections(sentenceReviewStores, ['reviewedToday', 'newCardsToday'], today),
    [sentenceReviewStores, today]
  );

  // Listener snapshots and page edits; a load that read the list before them must not undo them.
  const setCustomSentences = useCallback(
    (items: CustomSentence[]) => {
      setCustomSentencesState(items);
      localChanges.note('customItems');
    },
    [localChanges]
  );

  const { user } = useAuthContext();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsub = subscribeCustomSentences((items) => {
      // Dropped if the listener closed (sign-out or account switch) while it was being handled.
      if (active) setCustomSentences(items);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [user, setCustomSentences]);

  const updateSentenceReviewStore = useCallback(
    async (direction: TranslationDirection, store: SentenceReviewDataStore) => {
      const prevStore = storesRef.current[direction];
      const nextAll = { ...storesRef.current, [direction]: store };
      storesRef.current = nextAll;
      setSentenceReviewStores(nextAll);
      localChanges.note(`reviewStore:${direction}`);
      try {
        await saveSentenceReviewData(prevStore, store, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const updateSentenceSettingsFn = useCallback(
    async (direction: TranslationDirection, settings: SentenceDirectionSettings) => {
      setSentenceSettings((prev) => ({
        ...prev,
        [direction]: settings,
      }));
      localChanges.note(`settings:${direction}`);
      try {
        await saveSentenceSettings(settings, direction);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

  const clearSentenceReviewDataFn = useCallback(
    async (direction: TranslationDirection) => {
      try {
        await clearSentenceData(direction);
        const freshStore = getDefaultSentenceReviewStore();
        const nextAll = { ...storesRef.current, [direction]: freshStore };
        storesRef.current = nextAll;
        setSentenceReviewStores(nextAll);
        localChanges.note(`reviewStore:${direction}`);
      } catch (e) {
        showSaveError(e);
      }
    },
    [localChanges]
  );

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
        sentenceReviewStores: todaysReviewStores,
        sentenceSettings,
        sentences,
        customSentences,
        systemSentences,
        sentenceTags,
        updateSentenceReviewStore,
        updateSentenceSettings: updateSentenceSettingsFn,
        clearSentenceReviewData: clearSentenceReviewDataFn,
        setSentences,
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

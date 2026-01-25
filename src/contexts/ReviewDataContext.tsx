import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  DeclensionCard,
  CustomDeclensionCard,
  DeclensionReviewDataStore,
  DeclensionSettings,
} from '../types';
import type {
  VocabularyWord,
  VocabularyReviewDataStore,
  VocabularySettings,
  VocabularyDirectionSettings,
  VocabularyDirection,
  CustomVocabularyWord,
} from '../types/vocabulary';
import type {
  Sentence,
  SentenceReviewDataStore,
  SentenceSettings,
  SentenceDirection,
  SentenceDirectionSettings,
  TagCategory,
} from '../types/sentences';
import {
  loadSentenceTags,
  saveSentenceTags,
  DEFAULT_TAGS,
  type SentenceTagsData,
} from '../lib/storage/sentenceTags';
import loadDeclensionReviewData from '../lib/storage/loadDeclensionReviewData';
import loadDeclensionSettings from '../lib/storage/loadDeclensionSettings';
import saveDeclensionReviewData from '../lib/storage/saveDeclensionReviewData';
import saveDeclensionSettings from '../lib/storage/saveDeclensionSettings';
import loadVocabularyReviewData from '../lib/storage/loadVocabularyReviewData';
import loadVocabularySettings, {
  DEFAULT_VOCABULARY_SETTINGS,
} from '../lib/storage/loadVocabularySettings';
import saveVocabularyReviewData from '../lib/storage/saveVocabularyReviewData';
import saveVocabularySettings from '../lib/storage/saveVocabularySettings';
import loadSentenceReviewData from '../lib/storage/loadSentenceReviewData';
import loadSentenceSettings, {
  DEFAULT_SENTENCE_SETTINGS,
} from '../lib/storage/loadSentenceSettings';
import saveSentenceReviewData from '../lib/storage/saveSentenceReviewData';
import saveSentenceSettings from '../lib/storage/saveSentenceSettings';
import { loadCustomVocabulary } from '../lib/storage/customVocabulary';
import { loadCustomDeclension } from '../lib/storage/customDeclension';
import clearDeclensionData from '../lib/storage/clearDeclensionData';
import clearVocabularyData from '../lib/storage/clearVocabularyData';
import clearSentenceData from '../lib/storage/clearSentenceData';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import getOrCreateSentenceCardReviewData from '../lib/storage/getOrCreateSentenceCardReviewData';
import isDue from '../lib/fsrsUtils/isDue';
import {
  getUserId,
  getDefaultDeclensionReviewStore,
  getDefaultVocabularyReviewStore,
  getDefaultSentenceReviewStore,
  includesDeclensionCardId,
  includesSentenceId,
} from '../lib/storage/helpers';
import { showSaveError } from '../lib/storage/errorHandler';
import { DEFAULT_DECLENSION_SETTINGS } from '../constants';

export interface ReviewCounts {
  declension: number;
  vocabulary: number;
  sentences: number;
}

export interface ReviewDataContextType {
  loading: boolean;

  declensionCards: DeclensionCard[];
  customDeclensionCards: CustomDeclensionCard[];
  systemDeclensionCards: DeclensionCard[];
  declensionReviewStore: DeclensionReviewDataStore;
  declensionSettings: DeclensionSettings;
  updateDeclensionReviewStore: (
    store: DeclensionReviewDataStore
  ) => Promise<void>;
  updateDeclensionSettings: (settings: DeclensionSettings) => Promise<void>;
  clearDeclensionData: () => Promise<void>;
  setCustomDeclensionCards: (cards: CustomDeclensionCard[]) => void;
  setSystemDeclensionCards: (cards: DeclensionCard[]) => void;

  vocabularyReviewStores: Record<
    VocabularyDirection,
    VocabularyReviewDataStore
  >;
  vocabularySettings: VocabularySettings;
  vocabularyWords: VocabularyWord[];
  customWords: CustomVocabularyWord[];
  systemWords: VocabularyWord[];
  updateVocabularyReviewStore: (
    direction: VocabularyDirection,
    store: VocabularyReviewDataStore
  ) => Promise<void>;
  updateVocabularySettings: (
    direction: VocabularyDirection,
    settings: VocabularyDirectionSettings
  ) => Promise<void>;
  clearVocabularyReviewData: (direction: VocabularyDirection) => Promise<void>;
  refreshVocabularyWords: () => Promise<void>;
  setCustomWords: (words: CustomVocabularyWord[]) => void;
  setSystemWords: (words: VocabularyWord[]) => void;

  sentenceReviewStores: Record<SentenceDirection, SentenceReviewDataStore>;
  sentenceSettings: SentenceSettings;
  sentences: Sentence[];
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
  addSentenceTag: (category: TagCategory, tag: string) => Promise<void>;
  removeSentenceTag: (category: TagCategory, tag: string) => Promise<void>;

  counts: ReviewCounts;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ReviewDataContext = createContext<ReviewDataContextType | null>(
  null
);

function computeDeclensionDueCount(
  cards: DeclensionCard[],
  reviewStore: DeclensionReviewDataStore,
  settings: DeclensionSettings
): number {
  let dueReviews = 0;
  let newCards = 0;
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of cards) {
    const reviewData = getOrCreateDeclensionCardReviewData(
      card.id,
      reviewStore
    );
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;

    if (isNew) {
      if (
        !includesDeclensionCardId(reviewStore.newCardsToday, card.id) &&
        newCards < remainingNewCardsToday
      ) {
        newCards++;
      }
    } else if (isLearning) {
      if (!includesDeclensionCardId(reviewStore.reviewedToday, card.id)) {
        dueReviews++;
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesDeclensionCardId(reviewStore.reviewedToday, card.id)) {
        dueReviews++;
      }
    }
  }

  return dueReviews + newCards;
}

function computeVocabularyDueCount(
  words: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularyDirectionSettings
): number {
  let dueReviews = 0;
  let newCards = 0;
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of words) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;

    if (isNew) {
      const isAlreadyNew = reviewStore.newCardsToday.some(
        (id) => String(id) === String(word.id)
      );
      if (!isAlreadyNew && newCards < remainingNewCardsToday) {
        newCards++;
      }
    } else if (isLearning) {
      const isAlreadyReviewed = reviewStore.reviewedToday.some(
        (id) => String(id) === String(word.id)
      );
      if (!isAlreadyReviewed) {
        dueReviews++;
      }
    } else if (isDue(reviewData.fsrsCard)) {
      const isAlreadyReviewed = reviewStore.reviewedToday.some(
        (id) => String(id) === String(word.id)
      );
      if (!isAlreadyReviewed) {
        dueReviews++;
      }
    }
  }

  return dueReviews + newCards;
}

function computeSentenceDueCount(
  sentences: Sentence[],
  reviewStore: SentenceReviewDataStore,
  settings: SentenceDirectionSettings
): number {
  let dueReviews = 0;
  let newCards = 0;
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  const filteredSentences = sentences.filter((s) =>
    settings.selectedLevels.includes(s.level)
  );

  for (const sentence of filteredSentences) {
    const reviewData = getOrCreateSentenceCardReviewData(
      sentence.id,
      reviewStore
    );
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;

    if (isNew) {
      if (
        !includesSentenceId(reviewStore.newCardsToday, sentence.id) &&
        newCards < remainingNewCardsToday
      ) {
        newCards++;
      }
    } else if (isLearning) {
      if (!includesSentenceId(reviewStore.reviewedToday, sentence.id)) {
        dueReviews++;
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesSentenceId(reviewStore.reviewedToday, sentence.id)) {
        dueReviews++;
      }
    }
  }

  return dueReviews + newCards;
}

export function ReviewDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  const [customDeclensionCards, setCustomDeclensionCards] = useState<
    CustomDeclensionCard[]
  >([]);
  const [systemDeclensionCards, setSystemDeclensionCards] = useState<
    DeclensionCard[]
  >([]);
  const [declensionReviewStore, setDeclensionReviewStore] =
    useState<DeclensionReviewDataStore>(getDefaultDeclensionReviewStore);
  const [declensionSettings, setDeclensionSettings] =
    useState<DeclensionSettings>(DEFAULT_DECLENSION_SETTINGS);

  const declensionCards = useMemo<DeclensionCard[]>(
    () => [...customDeclensionCards, ...systemDeclensionCards],
    [customDeclensionCards, systemDeclensionCards]
  );

  const [vocabularyReviewStores, setVocabularyReviewStores] = useState<
    Record<VocabularyDirection, VocabularyReviewDataStore>
  >({
    'pl-to-en': getDefaultVocabularyReviewStore(),
    'en-to-pl': getDefaultVocabularyReviewStore(),
  });
  const [vocabularySettings, setVocabularySettings] =
    useState<VocabularySettings>(DEFAULT_VOCABULARY_SETTINGS);
  const [customWords, setCustomWords] = useState<CustomVocabularyWord[]>([]);
  const [systemWords, setSystemWords] = useState<VocabularyWord[]>([]);

  const vocabularyWords = useMemo<VocabularyWord[]>(
    () => [...customWords, ...systemWords],
    [customWords, systemWords]
  );

  const [sentenceReviewStores, setSentenceReviewStores] = useState<
    Record<SentenceDirection, SentenceReviewDataStore>
  >({
    'pl-to-en': getDefaultSentenceReviewStore(),
    'en-to-pl': getDefaultSentenceReviewStore(),
  });
  const [sentenceSettings, setSentenceSettings] = useState<SentenceSettings>(
    DEFAULT_SENTENCE_SETTINGS
  );
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [sentenceTags, setSentenceTags] =
    useState<SentenceTagsData>(DEFAULT_TAGS);

  const counts = useMemo<ReviewCounts>(() => {
    const userId = getUserId();
    if (!userId) {
      return { declension: 0, vocabulary: 0, sentences: 0 };
    }

    const declensionCount = computeDeclensionDueCount(
      declensionCards,
      declensionReviewStore,
      declensionSettings
    );

    const plToEnCount = computeVocabularyDueCount(
      vocabularyWords,
      vocabularyReviewStores['pl-to-en'],
      vocabularySettings['pl-to-en']
    );
    const enToPlCount = computeVocabularyDueCount(
      vocabularyWords,
      vocabularyReviewStores['en-to-pl'],
      vocabularySettings['en-to-pl']
    );

    const sentencePlToEnCount = computeSentenceDueCount(
      sentences,
      sentenceReviewStores['pl-to-en'],
      sentenceSettings['pl-to-en']
    );
    const sentenceEnToPlCount = computeSentenceDueCount(
      sentences,
      sentenceReviewStores['en-to-pl'],
      sentenceSettings['en-to-pl']
    );

    return {
      declension: declensionCount,
      vocabulary: plToEnCount + enToPlCount,
      sentences: sentencePlToEnCount + sentenceEnToPlCount,
    };
  }, [
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
    sentences,
    sentenceReviewStores,
    sentenceSettings,
  ]);

  const loadAllData = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      loadedDeclensionSettings,
      loadedDeclensionReviewData,
      loadedVocabularySettings,
      loadedSentenceSettings,
      loadedSentenceTags,
      loadedCustomWords,
      loadedCustomDeclensionCards,
      vocabularySnapshot,
      declensionCardsSnapshot,
      sentencesSnapshot,
    ] = await Promise.all([
      loadDeclensionSettings(),
      loadDeclensionReviewData(),
      loadVocabularySettings(),
      loadSentenceSettings(),
      loadSentenceTags(),
      loadCustomVocabulary(),
      loadCustomDeclension(),
      getDocs(collection(db, 'vocabulary')),
      getDocs(collection(db, 'declensionCards')),
      getDocs(collection(db, 'sentences')),
    ]);

    const loadedSystemWords = vocabularySnapshot.docs.map(
      (doc) => doc.data() as VocabularyWord
    );

    const loadedSystemDeclensionCards = declensionCardsSnapshot.docs.map(
      (doc) => doc.data() as DeclensionCard
    );

    const loadedSentences = sentencesSnapshot.docs.map(
      (doc) => doc.data() as Sentence
    );

    const [
      plToEnStore,
      enToPlStore,
      sentencePlToEnStore,
      sentenceEnToPlStore,
    ] = await Promise.all([
      loadVocabularyReviewData('pl-to-en'),
      loadVocabularyReviewData('en-to-pl'),
      loadSentenceReviewData('pl-to-en'),
      loadSentenceReviewData('en-to-pl'),
    ]);

    setCustomDeclensionCards(loadedCustomDeclensionCards);
    setSystemDeclensionCards(loadedSystemDeclensionCards);
    setDeclensionSettings(loadedDeclensionSettings);
    setDeclensionReviewStore(loadedDeclensionReviewData);
    setVocabularySettings(loadedVocabularySettings);
    setCustomWords(loadedCustomWords);
    setSystemWords(loadedSystemWords);
    setVocabularyReviewStores({
      'pl-to-en': plToEnStore,
      'en-to-pl': enToPlStore,
    });
    setSentenceSettings(loadedSentenceSettings);
    setSentences(loadedSentences);
    setSentenceTags(loadedSentenceTags);
    setSentenceReviewStores({
      'pl-to-en': sentencePlToEnStore,
      'en-to-pl': sentenceEnToPlStore,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDeclensionReviewStore = useCallback(
    async (store: DeclensionReviewDataStore) => {
      setDeclensionReviewStore(store);
      try {
        await saveDeclensionReviewData(store);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const updateDeclensionSettings = useCallback(
    async (settings: DeclensionSettings) => {
      setDeclensionSettings(settings);
      try {
        await saveDeclensionSettings(settings);
      } catch (e) {
        showSaveError(e);
      }
    },
    []
  );

  const clearDeclensionDataFn = useCallback(async () => {
    try {
      await clearDeclensionData();
      const freshStore = getDefaultDeclensionReviewStore();
      setDeclensionReviewStore(freshStore);
      setDeclensionSettings(DEFAULT_DECLENSION_SETTINGS);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const updateVocabularyReviewStore = useCallback(
    async (
      direction: VocabularyDirection,
      store: VocabularyReviewDataStore
    ) => {
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
    async (direction: VocabularyDirection, settings: VocabularyDirectionSettings) => {
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

  const clearVocabularyReviewDataFn = useCallback(
    async (direction: VocabularyDirection) => {
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
    },
    []
  );

  const refreshVocabularyWords = useCallback(async () => {
    const [loadedCustomWords, vocabularySnapshot] = await Promise.all([
      loadCustomVocabulary(),
      getDocs(collection(db, 'vocabulary')),
    ]);
    const loadedSystemWords = vocabularySnapshot.docs.map(
      (doc) => doc.data() as VocabularyWord
    );
    setCustomWords(loadedCustomWords);
    setSystemWords(loadedSystemWords);
  }, []);

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

  const clearSentenceReviewDataFn = useCallback(
    async (direction: SentenceDirection) => {
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
    },
    []
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
    <ReviewDataContext.Provider
      value={{
        loading,
        declensionCards,
        customDeclensionCards,
        systemDeclensionCards,
        declensionReviewStore,
        declensionSettings,
        updateDeclensionReviewStore,
        updateDeclensionSettings,
        clearDeclensionData: clearDeclensionDataFn,
        setCustomDeclensionCards,
        setSystemDeclensionCards,
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
        sentenceReviewStores,
        sentenceSettings,
        sentences,
        sentenceTags,
        updateSentenceReviewStore,
        updateSentenceSettings: updateSentenceSettingsFn,
        clearSentenceReviewData: clearSentenceReviewDataFn,
        setSentences,
        addSentenceTag,
        removeSentenceTag,
        counts,
      }}
    >
      {children}
    </ReviewDataContext.Provider>
  );
}

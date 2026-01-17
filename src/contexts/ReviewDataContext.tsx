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
  VocabularyDirection,
  CustomVocabularyWord,
} from '../types/vocabulary';
import loadDeclensionReviewData from '../lib/storage/loadDeclensionReviewData';
import loadDeclensionSettings from '../lib/storage/loadDeclensionSettings';
import saveDeclensionReviewData from '../lib/storage/saveDeclensionReviewData';
import saveDeclensionSettings from '../lib/storage/saveDeclensionSettings';
import loadVocabularyReviewData from '../lib/storage/loadVocabularyReviewData';
import loadVocabularySettings from '../lib/storage/loadVocabularySettings';
import saveVocabularyReviewData from '../lib/storage/saveVocabularyReviewData';
import saveVocabularySettings from '../lib/storage/saveVocabularySettings';
import { loadCustomVocabulary } from '../lib/storage/customVocabulary';
import { loadCustomDeclension } from '../lib/storage/customDeclension';
import clearDeclensionData from '../lib/storage/clearDeclensionData';
import clearVocabularyData from '../lib/storage/clearVocabularyData';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import isDue from '../lib/fsrsUtils/isDue';
import {
  getUserId,
  getDefaultDeclensionReviewStore,
  getDefaultVocabularyReviewStore,
  includesDeclensionCardId,
} from '../lib/storage/helpers';
import { DEFAULT_DECLENSION_SETTINGS } from '../constants';

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  newCardsPerDay: 10,
  direction: 'pl-to-en',
};

export interface ReviewCounts {
  declension: number;
  vocabulary: number;
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
  updateVocabularySettings: (settings: VocabularySettings) => Promise<void>;
  clearVocabularyReviewData: (direction: VocabularyDirection) => Promise<void>;
  refreshVocabularyWords: () => Promise<void>;
  setCustomWords: (words: CustomVocabularyWord[]) => void;
  setSystemWords: (words: VocabularyWord[]) => void;

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
  settings: VocabularySettings
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

  const counts = useMemo<ReviewCounts>(() => {
    const userId = getUserId();
    if (!userId) {
      return { declension: 0, vocabulary: 0 };
    }

    const declensionCount = computeDeclensionDueCount(
      declensionCards,
      declensionReviewStore,
      declensionSettings
    );

    const plToEnCount = computeVocabularyDueCount(
      vocabularyWords,
      vocabularyReviewStores['pl-to-en'],
      { ...vocabularySettings, direction: 'pl-to-en' }
    );
    const enToPlCount = computeVocabularyDueCount(
      vocabularyWords,
      vocabularyReviewStores['en-to-pl'],
      { ...vocabularySettings, direction: 'en-to-pl' }
    );

    return {
      declension: declensionCount,
      vocabulary: plToEnCount + enToPlCount,
    };
  }, [
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
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
      loadedCustomWords,
      loadedCustomDeclensionCards,
      vocabularySnapshot,
      declensionCardsSnapshot,
    ] = await Promise.all([
      loadDeclensionSettings(),
      loadDeclensionReviewData(),
      loadVocabularySettings(),
      loadCustomVocabulary(),
      loadCustomDeclension(),
      getDocs(collection(db, 'vocabulary')),
      getDocs(collection(db, 'declensionCards')),
    ]);

    const loadedSystemWords = vocabularySnapshot.docs.map(
      (doc) => doc.data() as VocabularyWord
    );

    const loadedSystemDeclensionCards = declensionCardsSnapshot.docs.map(
      (doc) => doc.data() as DeclensionCard
    );

    const [plToEnStore, enToPlStore] = await Promise.all([
      loadVocabularyReviewData('pl-to-en'),
      loadVocabularyReviewData('en-to-pl'),
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

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDeclensionReviewStore = useCallback(
    async (store: DeclensionReviewDataStore) => {
      setDeclensionReviewStore(store);
      await saveDeclensionReviewData(store);
    },
    []
  );

  const updateDeclensionSettings = useCallback(
    async (settings: DeclensionSettings) => {
      setDeclensionSettings(settings);
      await saveDeclensionSettings(settings);
    },
    []
  );

  const clearDeclensionDataFn = useCallback(async () => {
    await clearDeclensionData();
    const freshStore = getDefaultDeclensionReviewStore();
    setDeclensionReviewStore(freshStore);
    setDeclensionSettings(DEFAULT_DECLENSION_SETTINGS);
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
      await saveVocabularyReviewData(store, direction);
    },
    []
  );

  const updateVocabularySettingsFn = useCallback(
    async (settings: VocabularySettings) => {
      setVocabularySettings(settings);
      await saveVocabularySettings(settings);
    },
    []
  );

  const clearVocabularyReviewDataFn = useCallback(
    async (direction: VocabularyDirection) => {
      await clearVocabularyData(direction);
      const freshStore = getDefaultVocabularyReviewStore();
      setVocabularyReviewStores((prev) => ({
        ...prev,
        [direction]: freshStore,
      }));
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
        counts,
      }}
    >
      {children}
    </ReviewDataContext.Provider>
  );
}

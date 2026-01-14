import { createEmptyCard } from 'ts-fsrs';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Settings, ReviewDataStore, CardReviewData } from '../types';
import type {
  VocabularyReviewDataStore,
  VocabularyCardReviewData,
  VocabularySettings,
  VocabularyDirection,
} from '../types/vocabulary';

const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 10,
};

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultReviewStore(): ReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}

function getUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}

export async function loadSettings(): Promise<Settings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...DEFAULT_SETTINGS, ...(docSnap.data() as Settings) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'settings');
    await setDoc(docRef, settings);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export async function loadReviewData(): Promise<ReviewDataStore> {
  const userId = getUserId();
  if (!userId) return getDefaultReviewStore();

  try {
    const docRef = doc(db, 'users', userId, 'data', 'reviewData');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as ReviewDataStore;
      const today = getTodayString();
      if (parsed.lastReviewDate !== today) {
        parsed.reviewedToday = [];
        parsed.newCardsToday = [];
        parsed.lastReviewDate = today;
      }
      Object.keys(parsed.cards).forEach((key) => {
        const card = parsed.cards[parseInt(key)];
        if (card.fsrsCard.due) {
          card.fsrsCard.due = new Date(card.fsrsCard.due);
        }
        if (card.fsrsCard.last_review) {
          card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
        }
      });
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load review data:', e);
  }
  return getDefaultReviewStore();
}

export async function saveReviewData(data: ReviewDataStore): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'reviewData');
    const serializable = {
      ...data,
      cards: Object.fromEntries(
        Object.entries(data.cards).map(([key, card]) => [
          key,
          {
            ...card,
            fsrsCard: {
              ...card.fsrsCard,
              due:
                card.fsrsCard.due instanceof Date
                  ? card.fsrsCard.due.toISOString()
                  : card.fsrsCard.due,
              last_review:
                card.fsrsCard.last_review instanceof Date
                  ? card.fsrsCard.last_review.toISOString()
                  : card.fsrsCard.last_review,
            },
          },
        ])
      ),
    };
    await setDoc(docRef, serializable);
  } catch (e) {
    console.error('Failed to save review data:', e);
  }
}

export function getOrCreateCardReviewData(
  cardId: number,
  store: ReviewDataStore
): CardReviewData {
  if (store.cards[cardId]) {
    return store.cards[cardId];
  }
  return {
    cardId,
    fsrsCard: createEmptyCard(),
  };
}

export async function clearAllData(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await deleteDoc(doc(db, 'users', userId, 'data', 'reviewData'));
    await deleteDoc(doc(db, 'users', userId, 'data', 'settings'));
  } catch (e) {
    console.error('Failed to clear data:', e);
  }
}

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  newCardsPerDay: 10,
  direction: 'pl-en',
};

function getDefaultVocabularyReviewStore(): VocabularyReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}

function getVocabularyDocPath(direction: VocabularyDirection): string {
  return direction === 'pl-en'
    ? 'vocabularyReviewData-pl-en'
    : 'vocabularyReviewData-en-pl';
}

export async function loadVocabularySettings(): Promise<VocabularySettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_VOCABULARY_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'vocabularySettings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...DEFAULT_VOCABULARY_SETTINGS,
        ...(docSnap.data() as VocabularySettings),
      };
    }
  } catch (e) {
    console.error('Failed to load vocabulary settings:', e);
  }
  return DEFAULT_VOCABULARY_SETTINGS;
}

export async function saveVocabularySettings(
  settings: VocabularySettings
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'vocabularySettings');
    await setDoc(docRef, settings);
  } catch (e) {
    console.error('Failed to save vocabulary settings:', e);
  }
}

export async function loadVocabularyReviewData(
  direction: VocabularyDirection
): Promise<VocabularyReviewDataStore> {
  const userId = getUserId();
  if (!userId) return getDefaultVocabularyReviewStore();

  try {
    const docRef = doc(
      db,
      'users',
      userId,
      'data',
      getVocabularyDocPath(direction)
    );
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as VocabularyReviewDataStore;
      const today = getTodayString();
      if (parsed.lastReviewDate !== today) {
        parsed.reviewedToday = [];
        parsed.newCardsToday = [];
        parsed.lastReviewDate = today;
      }
      Object.keys(parsed.cards).forEach((key) => {
        const card = parsed.cards[parseInt(key)];
        if (card.fsrsCard.due) {
          card.fsrsCard.due = new Date(card.fsrsCard.due);
        }
        if (card.fsrsCard.last_review) {
          card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
        }
      });
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load vocabulary review data:', e);
  }
  return getDefaultVocabularyReviewStore();
}

export async function saveVocabularyReviewData(
  data: VocabularyReviewDataStore,
  direction: VocabularyDirection
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(
      db,
      'users',
      userId,
      'data',
      getVocabularyDocPath(direction)
    );
    const serializable = {
      ...data,
      cards: Object.fromEntries(
        Object.entries(data.cards).map(([key, card]) => [
          key,
          {
            ...card,
            fsrsCard: {
              ...card.fsrsCard,
              due:
                card.fsrsCard.due instanceof Date
                  ? card.fsrsCard.due.toISOString()
                  : card.fsrsCard.due,
              last_review:
                card.fsrsCard.last_review instanceof Date
                  ? card.fsrsCard.last_review.toISOString()
                  : card.fsrsCard.last_review,
            },
          },
        ])
      ),
    };
    await setDoc(docRef, serializable);
  } catch (e) {
    console.error('Failed to save vocabulary review data:', e);
  }
}

export function getOrCreateVocabularyCardReviewData(
  wordId: number,
  store: VocabularyReviewDataStore
): VocabularyCardReviewData {
  if (store.cards[wordId]) {
    return store.cards[wordId];
  }
  return {
    wordId,
    fsrsCard: createEmptyCard(),
  };
}

export async function clearVocabularyData(
  direction: VocabularyDirection
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await deleteDoc(
      doc(db, 'users', userId, 'data', getVocabularyDocPath(direction))
    );
  } catch (e) {
    console.error('Failed to clear vocabulary data:', e);
  }
}

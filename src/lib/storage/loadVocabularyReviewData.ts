import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  VocabularyReviewDataStore,
  VocabularyDirection,
} from '../../types/vocabulary';
import {
  getUserId,
  getTodayString,
  getDefaultVocabularyReviewStore,
  getVocabularyDocPath,
} from './helpers';

export default async function loadVocabularyReviewData(
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
        const card = parsed.cards[key];
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


import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { DeclensionReviewDataStore } from '../../types';
import { getUserId, getTodayString, getDefaultDeclensionReviewStore } from './helpers';

export default async function loadDeclensionReviewData(): Promise<DeclensionReviewDataStore> {
  const userId = getUserId();
  if (!userId) return getDefaultDeclensionReviewStore();

  try {
    const docRef = doc(db, 'users', userId, 'data', 'reviewData');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as DeclensionReviewDataStore;
      const today = getTodayString();
      if (parsed.lastReviewDate !== today) {
        parsed.reviewedToday = [];
        parsed.newCardsToday = [];
        parsed.lastReviewDate = today;
      }
      Object.keys(parsed.cards).forEach((key) => {
        const card = parsed.cards[key];
        if (!card?.fsrsCard) return;
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
    console.error('Failed to load declension review data:', e);
  }
  return getDefaultDeclensionReviewStore();
}


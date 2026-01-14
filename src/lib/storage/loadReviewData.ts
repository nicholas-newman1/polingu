import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ReviewDataStore } from '../../types';
import { getUserId, getTodayString, getDefaultReviewStore } from './helpers';

export default async function loadReviewData(): Promise<ReviewDataStore> {
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


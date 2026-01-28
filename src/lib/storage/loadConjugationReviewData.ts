import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ConjugationReviewDataStore, ConjugationDirection } from '../../types/conjugation';
import {
  getUserId,
  getTodayString,
  getDefaultConjugationReviewStore,
  getConjugationDocPath,
} from './helpers';

export default async function loadConjugationReviewData(
  direction: ConjugationDirection
): Promise<ConjugationReviewDataStore> {
  const userId = getUserId();
  if (!userId) return getDefaultConjugationReviewStore();

  try {
    const docRef = doc(db, 'users', userId, 'data', getConjugationDocPath(direction));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as ConjugationReviewDataStore;
      const today = getTodayString();
      if (parsed.lastReviewDate !== today) {
        parsed.reviewedToday = [];
        parsed.newFormsToday = [];
        parsed.lastReviewDate = today;
      }
      Object.keys(parsed.forms).forEach((key) => {
        const form = parsed.forms[key];
        if (!form?.fsrsCard) return;
        if (form.fsrsCard.due) {
          form.fsrsCard.due = new Date(form.fsrsCard.due);
        }
        if (form.fsrsCard.last_review) {
          form.fsrsCard.last_review = new Date(form.fsrsCard.last_review);
        }
      });
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load conjugation review data:', e);
  }
  return getDefaultConjugationReviewStore();
}

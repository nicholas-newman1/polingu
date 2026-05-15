import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserId, ASPECT_PAIRS_SESSION_DOC_PATH } from './helpers';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';

export default async function clearAspectPairsData(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await aspectPairsReviewStorage.clearAllCards();
    await Promise.all([
      deleteDoc(doc(db, 'users', userId, 'data', ASPECT_PAIRS_SESSION_DOC_PATH)),
      deleteDoc(doc(db, 'users', userId, 'data', 'aspectPairsSettings')),
    ]);
  } catch (e) {
    console.error('Failed to clear aspect pairs data:', e);
  }
}

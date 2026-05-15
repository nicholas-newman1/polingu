import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserId, DECLENSION_SESSION_DOC_PATH } from './helpers';
import { declensionReviewStorage } from './declensionReviewStorage';

export default async function clearDeclensionData(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await declensionReviewStorage.clearAllCards();
    await Promise.all([
      deleteDoc(doc(db, 'users', userId, 'data', DECLENSION_SESSION_DOC_PATH)),
      deleteDoc(doc(db, 'users', userId, 'data', 'settings')),
    ]);
  } catch (e) {
    console.error('Failed to clear declension data:', e);
  }
}

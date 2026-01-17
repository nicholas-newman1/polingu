import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserId } from './helpers';

export default async function clearDeclensionData(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await deleteDoc(doc(db, 'users', userId, 'data', 'reviewData'));
    await deleteDoc(doc(db, 'users', userId, 'data', 'settings'));
  } catch (e) {
    console.error('Failed to clear declension data:', e);
  }
}


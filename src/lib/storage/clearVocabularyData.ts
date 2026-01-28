import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { VocabularyDirection } from '../../types/vocabulary';
import { getUserId, getVocabularyDocPath } from './helpers';

export default async function clearVocabularyData(direction: VocabularyDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await deleteDoc(doc(db, 'users', userId, 'data', getVocabularyDocPath(direction)));
  } catch (e) {
    console.error('Failed to clear vocabulary data:', e);
  }
}

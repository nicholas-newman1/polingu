import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { SentenceDirection } from '../../types/sentences';
import { getUserId, getSentenceDocPath } from './helpers';

export default async function clearSentenceData(direction: SentenceDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await deleteDoc(doc(db, 'users', userId, 'data', getSentenceDocPath(direction)));
  } catch (e) {
    console.error('Failed to clear sentence data:', e);
  }
}

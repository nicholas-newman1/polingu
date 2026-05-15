import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { TranslationDirection } from '../../types/common';
import { getUserId, getSentenceSessionDocPath } from './helpers';
import { sentenceReviewStorage } from './sentenceReviewStorage';

export default async function clearSentenceData(direction: TranslationDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await sentenceReviewStorage(direction).clearAllCards();
    await deleteDoc(doc(db, 'users', userId, 'data', getSentenceSessionDocPath(direction)));
  } catch (e) {
    console.error('Failed to clear sentence data:', e);
  }
}

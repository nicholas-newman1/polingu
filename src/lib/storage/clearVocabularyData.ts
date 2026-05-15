import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { TranslationDirection } from '../../types/common';
import { getUserId, getVocabularySessionDocPath } from './helpers';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';

export default async function clearVocabularyData(direction: TranslationDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    await vocabularyReviewStorage(direction).clearAllCards();
    await deleteDoc(doc(db, 'users', userId, 'data', getVocabularySessionDocPath(direction)));
  } catch (e) {
    console.error('Failed to clear vocabulary data:', e);
  }
}

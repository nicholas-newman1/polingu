import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { TranslationDirection } from '../../types/common';
import { getUserId, getConjugationSessionDocPath } from './helpers';
import { getConjugationSettingsDocPath } from './loadConjugationSettings';
import { conjugationReviewStorage } from './conjugationReviewStorage';

export default async function clearConjugationData(direction: TranslationDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const sessionRef = doc(db, 'users', userId, 'data', getConjugationSessionDocPath(direction));
  const settingsRef = doc(db, 'users', userId, 'data', getConjugationSettingsDocPath(direction));

  await Promise.all([
    conjugationReviewStorage(direction).clearAllCards(),
    deleteDoc(sessionRef),
    deleteDoc(settingsRef),
  ]);
}

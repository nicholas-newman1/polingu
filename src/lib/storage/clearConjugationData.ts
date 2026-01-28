import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ConjugationDirection } from '../../types/conjugation';
import { getUserId, getConjugationDocPath } from './helpers';
import { getConjugationSettingsDocPath } from './loadConjugationSettings';

export default async function clearConjugationData(direction: ConjugationDirection): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const reviewDataRef = doc(db, 'users', userId, 'data', getConjugationDocPath(direction));
  const settingsRef = doc(db, 'users', userId, 'data', getConjugationSettingsDocPath(direction));

  await Promise.all([deleteDoc(reviewDataRef), deleteDoc(settingsRef)]);
}

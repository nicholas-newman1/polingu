import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { DeclensionSettings } from '../../types';
import { getUserId } from './helpers';

export default async function saveDeclensionSettings(settings: DeclensionSettings): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const docRef = doc(db, 'users', userId, 'data', 'settings');
  await setDoc(docRef, settings);
}

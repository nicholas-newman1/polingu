import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { DeclensionSettings } from '../../types';
import { getUserId } from './helpers';

const DEFAULT_DECLENSION_SETTINGS: DeclensionSettings = {
  newCardsPerDay: 10,
};

export default async function loadDeclensionSettings(): Promise<DeclensionSettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_DECLENSION_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...DEFAULT_DECLENSION_SETTINGS, ...(docSnap.data() as DeclensionSettings) };
    }
  } catch (e) {
    console.error('Failed to load declension settings:', e);
  }
  return DEFAULT_DECLENSION_SETTINGS;
}


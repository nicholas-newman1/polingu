import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Settings } from '../../types';
import { getUserId } from './helpers';

const DEFAULT_SETTINGS: Settings = {
  newCardsPerDay: 10,
};

export default async function loadSettings(): Promise<Settings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...DEFAULT_SETTINGS, ...(docSnap.data() as Settings) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}


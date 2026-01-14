import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Settings } from '../../types';
import { getUserId } from './helpers';

export default async function saveSettings(settings: Settings): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'settings');
    await setDoc(docRef, settings);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}


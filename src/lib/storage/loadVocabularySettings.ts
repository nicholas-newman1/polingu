import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { VocabularySettings } from '../../types/vocabulary';
import { getUserId } from './helpers';

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  newCardsPerDay: 10,
  direction: 'pl-to-en',
};

export default async function loadVocabularySettings(): Promise<VocabularySettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_VOCABULARY_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'vocabularySettings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...DEFAULT_VOCABULARY_SETTINGS,
        ...(docSnap.data() as VocabularySettings),
      };
    }
  } catch (e) {
    console.error('Failed to load vocabulary settings:', e);
  }
  return DEFAULT_VOCABULARY_SETTINGS;
}

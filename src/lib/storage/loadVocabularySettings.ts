import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  VocabularySettings,
  VocabularyDirectionSettings,
  VocabularyDirection,
} from '../../types/vocabulary';
import { getUserId } from './helpers';

const DEFAULT_DIRECTION_SETTINGS: VocabularyDirectionSettings = {
  newCardsPerDay: 10,
};

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getVocabularySettingsDocPath(direction: VocabularyDirection): string {
  return direction === 'pl-to-en' ? 'vocabularySettings-pl-en' : 'vocabularySettings-en-pl';
}

export async function loadVocabularyDirectionSettings(
  direction: VocabularyDirection
): Promise<VocabularyDirectionSettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_DIRECTION_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', getVocabularySettingsDocPath(direction));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...DEFAULT_DIRECTION_SETTINGS,
        ...(docSnap.data() as VocabularyDirectionSettings),
      };
    }
  } catch (e) {
    console.error('Failed to load vocabulary settings:', e);
  }
  return DEFAULT_DIRECTION_SETTINGS;
}

export default async function loadVocabularySettings(): Promise<VocabularySettings> {
  const [plToEn, enToPl] = await Promise.all([
    loadVocabularyDirectionSettings('pl-to-en'),
    loadVocabularyDirectionSettings('en-to-pl'),
  ]);
  return {
    'pl-to-en': plToEn,
    'en-to-pl': enToPl,
  };
}

export { DEFAULT_VOCABULARY_SETTINGS, DEFAULT_DIRECTION_SETTINGS, getVocabularySettingsDocPath };

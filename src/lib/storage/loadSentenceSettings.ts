import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  SentenceSettings,
  SentenceDirectionSettings,
  SentenceDirection,
} from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { getUserId } from './helpers';

const DEFAULT_DIRECTION_SETTINGS: SentenceDirectionSettings = {
  newCardsPerDay: 5,
  selectedLevels: [...ALL_LEVELS],
};

const DEFAULT_SENTENCE_SETTINGS: SentenceSettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getSentenceSettingsDocPath(direction: SentenceDirection): string {
  return direction === 'pl-to-en' ? 'sentenceSettings-pl-en' : 'sentenceSettings-en-pl';
}

export async function loadSentenceDirectionSettings(
  direction: SentenceDirection
): Promise<SentenceDirectionSettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_DIRECTION_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', getSentenceSettingsDocPath(direction));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...DEFAULT_DIRECTION_SETTINGS,
        ...(docSnap.data() as SentenceDirectionSettings),
      };
    }
  } catch (e) {
    console.error('Failed to load sentence settings:', e);
  }
  return DEFAULT_DIRECTION_SETTINGS;
}

export default async function loadSentenceSettings(): Promise<SentenceSettings> {
  const [plToEn, enToPl] = await Promise.all([
    loadSentenceDirectionSettings('pl-to-en'),
    loadSentenceDirectionSettings('en-to-pl'),
  ]);
  return {
    'pl-to-en': plToEn,
    'en-to-pl': enToPl,
  };
}

export { DEFAULT_SENTENCE_SETTINGS, DEFAULT_DIRECTION_SETTINGS, getSentenceSettingsDocPath };

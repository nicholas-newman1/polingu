import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ConjugationSettings,
  ConjugationDirectionSettings,
  ConjugationDirection,
} from '../../types/conjugation';
import { getUserId } from './helpers';

const DEFAULT_DIRECTION_SETTINGS: ConjugationDirectionSettings = {
  newCardsPerDay: 10,
};

const DEFAULT_CONJUGATION_SETTINGS: ConjugationSettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getConjugationSettingsDocPath(direction: ConjugationDirection): string {
  return direction === 'pl-to-en' ? 'conjugationSettings-pl-en' : 'conjugationSettings-en-pl';
}

export async function loadConjugationDirectionSettings(
  direction: ConjugationDirection
): Promise<ConjugationDirectionSettings> {
  const userId = getUserId();
  if (!userId) return DEFAULT_DIRECTION_SETTINGS;

  try {
    const docRef = doc(db, 'users', userId, 'data', getConjugationSettingsDocPath(direction));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...DEFAULT_DIRECTION_SETTINGS,
        ...(docSnap.data() as ConjugationDirectionSettings),
      };
    }
  } catch (e) {
    console.error('Failed to load conjugation settings:', e);
  }
  return DEFAULT_DIRECTION_SETTINGS;
}

export default async function loadConjugationSettings(): Promise<ConjugationSettings> {
  const [plToEn, enToPl] = await Promise.all([
    loadConjugationDirectionSettings('pl-to-en'),
    loadConjugationDirectionSettings('en-to-pl'),
  ]);
  return {
    'pl-to-en': plToEn,
    'en-to-pl': enToPl,
  };
}

export { DEFAULT_CONJUGATION_SETTINGS, DEFAULT_DIRECTION_SETTINGS, getConjugationSettingsDocPath };

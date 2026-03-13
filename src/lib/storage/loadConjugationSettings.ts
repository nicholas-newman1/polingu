import type { ConjugationSettings, ConjugationDirectionSettings } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { loadUserData } from '../offlineDb/userDataWrapper';

const DEFAULT_DIRECTION_SETTINGS: ConjugationDirectionSettings = {
  newCardsPerDay: 10,
};

const DEFAULT_CONJUGATION_SETTINGS: ConjugationSettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getConjugationSettingsDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en' ? 'conjugationSettings-pl-en' : 'conjugationSettings-en-pl';
}

export async function loadConjugationDirectionSettings(
  direction: TranslationDirection
): Promise<ConjugationDirectionSettings> {
  return loadUserData(
    getConjugationSettingsDocPath(direction),
    DEFAULT_DIRECTION_SETTINGS,
    (data) => ({
      ...DEFAULT_DIRECTION_SETTINGS,
      ...(data as ConjugationDirectionSettings),
    })
  );
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

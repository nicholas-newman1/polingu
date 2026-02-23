import type { VocabularySettings, VocabularyDirectionSettings } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

const DEFAULT_DIRECTION_SETTINGS: VocabularyDirectionSettings = {
  newCardsPerDay: 10,
};

const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getVocabularySettingsDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en' ? 'vocabularySettings-pl-en' : 'vocabularySettings-en-pl';
}

export async function loadVocabularyDirectionSettings(
  direction: TranslationDirection
): Promise<VocabularyDirectionSettings> {
  return loadUserDataOfflineFirst(
    getVocabularySettingsDocPath(direction),
    DEFAULT_DIRECTION_SETTINGS,
    (data) => ({
      ...DEFAULT_DIRECTION_SETTINGS,
      ...(data as VocabularyDirectionSettings),
    })
  );
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

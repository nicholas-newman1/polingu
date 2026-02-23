import type { SentenceSettings, SentenceDirectionSettings } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { ALL_LEVELS } from '../../types/sentences';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

const DEFAULT_DIRECTION_SETTINGS: SentenceDirectionSettings = {
  newCardsPerDay: 5,
  selectedLevels: [...ALL_LEVELS],
};

const DEFAULT_SENTENCE_SETTINGS: SentenceSettings = {
  'pl-to-en': { ...DEFAULT_DIRECTION_SETTINGS },
  'en-to-pl': { ...DEFAULT_DIRECTION_SETTINGS },
};

function getSentenceSettingsDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en' ? 'sentenceSettings-pl-en' : 'sentenceSettings-en-pl';
}

export async function loadSentenceDirectionSettings(
  direction: TranslationDirection
): Promise<SentenceDirectionSettings> {
  return loadUserDataOfflineFirst(
    getSentenceSettingsDocPath(direction),
    DEFAULT_DIRECTION_SETTINGS,
    (data) => ({
      ...DEFAULT_DIRECTION_SETTINGS,
      ...(data as SentenceDirectionSettings),
    })
  );
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

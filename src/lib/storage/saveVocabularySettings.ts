import type { VocabularyDirectionSettings } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { getVocabularySettingsDocPath } from './loadVocabularySettings';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveVocabularySettings(
  settings: VocabularyDirectionSettings,
  direction: TranslationDirection
): Promise<void> {
  await saveUserDataOfflineFirst(getVocabularySettingsDocPath(direction), settings);
}

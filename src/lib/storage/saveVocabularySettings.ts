import type { VocabularyDirectionSettings } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { getVocabularySettingsDocPath } from './loadVocabularySettings';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveVocabularySettings(
  settings: VocabularyDirectionSettings,
  direction: TranslationDirection
): Promise<void> {
  await saveUserData(getVocabularySettingsDocPath(direction), settings);
}

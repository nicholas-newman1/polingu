import type { SentenceDirectionSettings } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { getSentenceSettingsDocPath } from './loadSentenceSettings';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveSentenceSettings(
  settings: SentenceDirectionSettings,
  direction: TranslationDirection
): Promise<void> {
  await saveUserData(getSentenceSettingsDocPath(direction), settings);
}

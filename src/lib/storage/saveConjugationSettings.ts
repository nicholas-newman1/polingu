import type { ConjugationDirectionSettings } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getConjugationSettingsDocPath } from './loadConjugationSettings';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveConjugationSettings(
  settings: ConjugationDirectionSettings,
  direction: TranslationDirection
): Promise<void> {
  await saveUserDataOfflineFirst(getConjugationSettingsDocPath(direction), settings);
}

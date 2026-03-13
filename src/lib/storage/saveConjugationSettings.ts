import type { ConjugationDirectionSettings } from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { getConjugationSettingsDocPath } from './loadConjugationSettings';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveConjugationSettings(
  settings: ConjugationDirectionSettings,
  direction: TranslationDirection
): Promise<void> {
  await saveUserData(getConjugationSettingsDocPath(direction), settings);
}

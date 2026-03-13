import type { AspectPairsSettings } from '../../types/aspectPairs';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveAspectPairsSettings(
  settings: AspectPairsSettings
): Promise<void> {
  await saveUserData('aspectPairsSettings', settings);
}

import type { AspectPairsSettings } from '../../types/aspectPairs';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveAspectPairsSettings(
  settings: AspectPairsSettings
): Promise<void> {
  await saveUserDataOfflineFirst('aspectPairsSettings', settings);
}

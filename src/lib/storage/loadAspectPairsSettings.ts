import type { AspectPairsSettings } from '../../types/aspectPairs';
import { DEFAULT_ASPECT_PAIRS_SETTINGS } from '../../types/aspectPairs';
import { loadUserData } from '../offlineDb/userDataWrapper';

export default async function loadAspectPairsSettings(): Promise<AspectPairsSettings> {
  return loadUserData('aspectPairsSettings', DEFAULT_ASPECT_PAIRS_SETTINGS, (data) => ({
    ...DEFAULT_ASPECT_PAIRS_SETTINGS,
    ...(data as AspectPairsSettings),
  }));
}

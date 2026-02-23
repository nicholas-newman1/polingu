import type { DeclensionSettings } from '../../types';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

const DEFAULT_DECLENSION_SETTINGS: DeclensionSettings = {
  newCardsPerDay: 10,
};

export default async function loadDeclensionSettings(): Promise<DeclensionSettings> {
  return loadUserDataOfflineFirst('settings', DEFAULT_DECLENSION_SETTINGS, (data) => ({
    ...DEFAULT_DECLENSION_SETTINGS,
    ...(data as DeclensionSettings),
  }));
}

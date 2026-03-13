import type { DeclensionSettings } from '../../types';
import { loadUserData } from '../offlineDb/userDataWrapper';

const DEFAULT_DECLENSION_SETTINGS: DeclensionSettings = {
  newCardsPerDay: 10,
};

export default async function loadDeclensionSettings(): Promise<DeclensionSettings> {
  return loadUserData('settings', DEFAULT_DECLENSION_SETTINGS, (data) => ({
    ...DEFAULT_DECLENSION_SETTINGS,
    ...(data as DeclensionSettings),
  }));
}

import type { AppSettings } from '../../types/appSettings';
import { DEFAULT_APP_SETTINGS } from '../../types/appSettings';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function loadAppSettings(): Promise<AppSettings> {
  return loadUserDataOfflineFirst('appSettings', DEFAULT_APP_SETTINGS, (data) => ({
    ...DEFAULT_APP_SETTINGS,
    ...(data as AppSettings),
  }));
}

import type { AppSettings } from '../../types/appSettings';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveAppSettings(settings: AppSettings): Promise<void> {
  await saveUserDataOfflineFirst('appSettings', settings);
}

import type { AppSettings } from '../../types/appSettings';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveAppSettings(settings: AppSettings): Promise<void> {
  await saveUserData('appSettings', settings);
}

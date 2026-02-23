import type { DeclensionSettings } from '../../types';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

export default async function saveDeclensionSettings(settings: DeclensionSettings): Promise<void> {
  await saveUserDataOfflineFirst('settings', settings);
}

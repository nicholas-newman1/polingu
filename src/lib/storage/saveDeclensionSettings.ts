import type { DeclensionSettings } from '../../types';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveDeclensionSettings(settings: DeclensionSettings): Promise<void> {
  await saveUserData('settings', settings);
}

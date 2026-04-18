import type { ListeningSettings } from '../../types/listening';
import { LISTENING_SETTINGS_DOC_PATH } from './loadListeningSettings';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveListeningSettings(settings: ListeningSettings): Promise<void> {
  await saveUserData(LISTENING_SETTINGS_DOC_PATH, settings);
}

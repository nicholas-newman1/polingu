import type { ListeningHubSelections } from '../../types/listening';
import { LISTENING_HUB_SELECTIONS_DOC_PATH } from './loadListeningHubSelections';
import { saveUserData } from '../offlineDb/userDataWrapper';

export default async function saveListeningHubSelections(
  selections: ListeningHubSelections
): Promise<void> {
  await saveUserData(LISTENING_HUB_SELECTIONS_DOC_PATH, selections);
}

import { getUserId, DECLENSION_SESSION_DOC_PATH } from './helpers';
import { declensionReviewStorage } from './declensionReviewStorage';
import { deleteUserData } from '../offlineDb/userDataWrapper';

/** Resets declension progress and settings. Rejects if the server could not be updated. */
export default async function clearDeclensionData(): Promise<void> {
  if (!getUserId()) return;

  await declensionReviewStorage.clearAllCards();
  await Promise.all([deleteUserData(DECLENSION_SESSION_DOC_PATH), deleteUserData('settings')]);
}

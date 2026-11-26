import { getUserId, ASPECT_PAIRS_SESSION_DOC_PATH } from './helpers';
import { aspectPairsReviewStorage } from './aspectPairsReviewStorage';
import { deleteUserData } from '../offlineDb/userDataWrapper';

/** Resets aspect-pair progress and settings. Rejects if the server could not be updated. */
export default async function clearAspectPairsData(): Promise<void> {
  if (!getUserId()) return;

  await aspectPairsReviewStorage.clearAllCards();
  await Promise.all([
    deleteUserData(ASPECT_PAIRS_SESSION_DOC_PATH),
    deleteUserData('aspectPairsSettings'),
  ]);
}

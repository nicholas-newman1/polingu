import type { TranslationDirection } from '../../types/common';
import { getUserId, getVocabularySessionDocPath } from './helpers';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';
import { deleteUserData } from '../offlineDb/userDataWrapper';

/** Resets one direction's vocabulary progress. Rejects if the server could not be updated. */
export default async function clearVocabularyData(direction: TranslationDirection): Promise<void> {
  if (!getUserId()) return;

  await vocabularyReviewStorage(direction).clearAllCards();
  await deleteUserData(getVocabularySessionDocPath(direction));
}

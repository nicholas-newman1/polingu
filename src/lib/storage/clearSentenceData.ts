import type { TranslationDirection } from '../../types/common';
import { getUserId, getSentenceSessionDocPath } from './helpers';
import { sentenceReviewStorage } from './sentenceReviewStorage';
import { deleteUserData } from '../offlineDb/userDataWrapper';

/** Resets one direction's sentence progress. Rejects if the server could not be updated. */
export default async function clearSentenceData(direction: TranslationDirection): Promise<void> {
  if (!getUserId()) return;

  await sentenceReviewStorage(direction).clearAllCards();
  await deleteUserData(getSentenceSessionDocPath(direction));
}

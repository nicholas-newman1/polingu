import type { TranslationDirection } from '../../types/common';
import { getUserId, getConjugationSessionDocPath } from './helpers';
import { getConjugationSettingsDocPath } from './loadConjugationSettings';
import { conjugationReviewStorage } from './conjugationReviewStorage';
import { deleteUserData } from '../offlineDb/userDataWrapper';

/** Resets one direction's conjugation progress and settings. Rejects if the server could not be updated. */
export default async function clearConjugationData(direction: TranslationDirection): Promise<void> {
  if (!getUserId()) return;

  await conjugationReviewStorage(direction).clearAllCards();
  await Promise.all([
    deleteUserData(getConjugationSessionDocPath(direction)),
    deleteUserData(getConjugationSettingsDocPath(direction)),
  ]);
}

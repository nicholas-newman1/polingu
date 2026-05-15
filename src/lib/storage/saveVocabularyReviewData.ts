import type { VocabularyReviewDataStore } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { getVocabularySessionDocPath } from './helpers';
import { saveUserData } from '../offlineDb/userDataWrapper';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';

interface VocabularyReviewSession {
  reviewedToday: VocabularyReviewDataStore['reviewedToday'];
  newCardsToday: VocabularyReviewDataStore['newCardsToday'];
  lastReviewDate: string;
}

export default async function saveVocabularyReviewData(
  prev: VocabularyReviewDataStore | null,
  next: VocabularyReviewDataStore,
  direction: TranslationDirection
): Promise<void> {
  const storage = vocabularyReviewStorage(direction);
  const session: VocabularyReviewSession = {
    reviewedToday: next.reviewedToday,
    newCardsToday: next.newCardsToday,
    lastReviewDate: next.lastReviewDate,
  };
  await Promise.all([
    storage.saveCardsDiff(prev?.cards ?? null, next.cards),
    saveUserData(getVocabularySessionDocPath(direction), session),
  ]);
}

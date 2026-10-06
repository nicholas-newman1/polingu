import type { VocabularyReviewDataStore } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { getDefaultVocabularyReviewStore, getVocabularySessionDocPath } from './helpers';
import { vocabularyReviewStorage } from './vocabularyReviewStorage';
import loadDailyReviewSession from './loadDailyReviewSession';

export default async function loadVocabularyReviewData(
  direction: TranslationDirection
): Promise<VocabularyReviewDataStore> {
  const { reviewedToday, newCardsToday, lastReviewDate } = getDefaultVocabularyReviewStore();
  const [cards, session] = await loadDailyReviewSession(
    vocabularyReviewStorage(direction),
    getVocabularySessionDocPath(direction),
    {
      reviewedToday,
      newCardsToday,
      lastReviewDate,
    }
  );

  return {
    cards,
    reviewedToday: session.reviewedToday,
    newCardsToday: session.newCardsToday,
    lastReviewDate: session.lastReviewDate,
  };
}

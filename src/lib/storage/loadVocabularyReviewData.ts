import type { VocabularyReviewDataStore } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { getTodayString, getDefaultVocabularyReviewStore, getVocabularyDocPath } from './helpers';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

function deserializeVocabularyReviewData(data: unknown): VocabularyReviewDataStore {
  const parsed = data as VocabularyReviewDataStore;
  const today = getTodayString();
  if (parsed.lastReviewDate !== today) {
    parsed.reviewedToday = [];
    parsed.newCardsToday = [];
    parsed.lastReviewDate = today;
  }
  Object.keys(parsed.cards).forEach((key) => {
    const card = parsed.cards[key];
    if (!card?.fsrsCard) return;
    if (card.fsrsCard.due) {
      card.fsrsCard.due = new Date(card.fsrsCard.due);
    }
    if (card.fsrsCard.last_review) {
      card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
    }
  });
  return parsed;
}

export default async function loadVocabularyReviewData(
  direction: TranslationDirection
): Promise<VocabularyReviewDataStore> {
  return loadUserDataOfflineFirst(
    getVocabularyDocPath(direction),
    getDefaultVocabularyReviewStore(),
    deserializeVocabularyReviewData
  );
}

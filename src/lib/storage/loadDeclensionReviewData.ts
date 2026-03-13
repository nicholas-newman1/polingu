import type { DeclensionReviewDataStore } from '../../types';
import { getTodayString, getDefaultDeclensionReviewStore } from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';

function deserializeDeclensionReviewData(data: unknown): DeclensionReviewDataStore {
  const parsed = data as DeclensionReviewDataStore;
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

export default async function loadDeclensionReviewData(): Promise<DeclensionReviewDataStore> {
  return loadUserData(
    'reviewData',
    getDefaultDeclensionReviewStore(),
    deserializeDeclensionReviewData
  );
}

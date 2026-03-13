import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { getTodayString, getDefaultSentenceReviewStore, getSentenceDocPath } from './helpers';
import { loadUserData } from '../offlineDb/userDataWrapper';

function deserializeSentenceReviewData(data: unknown): SentenceReviewDataStore {
  const parsed = data as SentenceReviewDataStore;
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

export default async function loadSentenceReviewData(
  direction: TranslationDirection
): Promise<SentenceReviewDataStore> {
  return loadUserData(
    getSentenceDocPath(direction),
    getDefaultSentenceReviewStore(),
    deserializeSentenceReviewData
  );
}

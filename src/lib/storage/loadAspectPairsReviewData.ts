import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { getTodayString, getDefaultAspectPairsReviewStore } from './helpers';
import { loadUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

function deserializeAspectPairsReviewData(data: unknown): AspectPairsReviewDataStore {
  const parsed = data as AspectPairsReviewDataStore;
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

export default async function loadAspectPairsReviewData(): Promise<AspectPairsReviewDataStore> {
  return loadUserDataOfflineFirst(
    'aspectPairsReviewData',
    getDefaultAspectPairsReviewStore(),
    deserializeAspectPairsReviewData
  );
}

import type { VocabularyReviewDataStore, VocabularyWordId } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import forgetCard from '../fsrsUtils/forgetCard';

export function canReprioritizeVocabularyWord(
  stores: Record<TranslationDirection, VocabularyReviewDataStore>,
  wordId: VocabularyWordId
): boolean {
  const key = String(wordId);
  const plToEn = stores['pl-to-en'].cards[key];
  const enToPl = stores['en-to-pl'].cards[key];
  return Boolean(
    (plToEn && plToEn.fsrsCard.state !== 0) || (enToPl && enToPl.fsrsCard.state !== 0)
  );
}

export default function reprioritizeVocabularyWord(
  store: VocabularyReviewDataStore,
  wordId: VocabularyWordId,
  now: Date = new Date()
): VocabularyReviewDataStore {
  const key = String(wordId);
  const entry = store.cards[key];
  if (!entry || entry.fsrsCard.state === 0) {
    return store;
  }
  return {
    ...store,
    cards: { ...store.cards, [key]: forgetCard(entry, now) },
    reviewedToday: store.reviewedToday.filter((id) => String(id) !== key),
    newCardsToday: store.newCardsToday.filter((id) => String(id) !== key),
  };
}

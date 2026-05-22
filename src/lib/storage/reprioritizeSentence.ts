import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import forgetCard from '../fsrsUtils/forgetCard';

export function canReprioritizeSentence(
  stores: Record<TranslationDirection, SentenceReviewDataStore>,
  sentenceId: string
): boolean {
  const plToEn = stores['pl-to-en'].cards[sentenceId];
  const enToPl = stores['en-to-pl'].cards[sentenceId];
  return Boolean(
    (plToEn && plToEn.fsrsCard.state !== 0) || (enToPl && enToPl.fsrsCard.state !== 0)
  );
}

export default function reprioritizeSentence(
  store: SentenceReviewDataStore,
  sentenceId: string,
  now: Date = new Date()
): SentenceReviewDataStore {
  const entry = store.cards[sentenceId];
  if (!entry || entry.fsrsCard.state === 0) {
    return store;
  }
  return {
    ...store,
    cards: { ...store.cards, [sentenceId]: forgetCard(entry, now) },
    reviewedToday: store.reviewedToday.filter((id) => id !== sentenceId),
    newCardsToday: store.newCardsToday.filter((id) => id !== sentenceId),
  };
}

import type { VocabularySessionCard } from './types';

const isPrioritized = (card: VocabularySessionCard) => card.reviewData.prioritizedAt !== undefined;

/**
 * New cards in the order they are introduced: words the learner asked to study next come
 * first, most recent request first; the rest keep their order.
 */
export default function prioritizeNewCards(
  cards: VocabularySessionCard[]
): VocabularySessionCard[] {
  const prioritized = cards
    .filter(isPrioritized)
    .sort((a, b) => b.reviewData.prioritizedAt! - a.reviewData.prioritizedAt!);
  return [...prioritized, ...cards.filter((card) => !isPrioritized(card))];
}

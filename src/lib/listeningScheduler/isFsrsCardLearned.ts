import type { Card as FSRSCard } from 'ts-fsrs';

export default function isFsrsCardLearned(fsrsCard: FSRSCard): boolean {
  return fsrsCard.state === 2;
}

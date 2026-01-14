import type { Card as FSRSCard } from 'ts-fsrs';

export default function isDue(fsrsCard: FSRSCard): boolean {
  if (fsrsCard.state === 0) return false;
  return new Date(fsrsCard.due) <= new Date();
}


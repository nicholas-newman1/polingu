import { State, type Card as FSRSCard } from 'ts-fsrs';
import isDue from './isDue';

/**
 * Whether a card may be offered by "Review early": a graduated card that is not yet due
 * and has not been reviewed today. Learning/relearning cards are left out because their
 * minute-scale steps would put them at the front of every round, and cards reviewed today
 * are left out so repeated rounds move on to fresh cards.
 */
export default function isPracticeAheadCandidate(
  fsrsCard: FSRSCard,
  reviewedToday: boolean
): boolean {
  return fsrsCard.state === State.Review && !isDue(fsrsCard) && !reviewedToday;
}

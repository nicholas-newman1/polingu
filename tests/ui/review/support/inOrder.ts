/**
 * Stand-in for src/lib/utils/shuffleArray that keeps the input order, so decks
 * the app shuffles (new declension cards, drill mode, the consonant driller)
 * come out in a known order. Install with
 *
 *   vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));
 */
export default function shuffleArray<T>(array: T[]): T[] {
  return [...array];
}

export function balancedShuffle<T>(array: T[]): T[] {
  return [...array];
}

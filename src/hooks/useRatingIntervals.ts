import { useMemo } from 'react';
import type { Card as FSRSCard } from 'ts-fsrs';
import getNextIntervals from '../lib/fsrsUtils/getNextIntervals';
import type { RatingIntervals } from '../components/RatingButtons';

export function useRatingIntervals(fsrsCard: FSRSCard | undefined): RatingIntervals | undefined {
  return useMemo(() => (fsrsCard ? getNextIntervals(fsrsCard) : undefined), [fsrsCard]);
}

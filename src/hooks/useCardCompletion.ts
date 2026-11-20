import { useCallback, useEffect, useRef, useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';

export type CardCompletionOutcome = 'again' | 'hard' | 'good' | 'easy' | 'next';

const CARD_COMPLETION_DURATION_MS = 320;

const RATING_TO_OUTCOME: Record<Grade, CardCompletionOutcome> = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
};

export function ratingToCompletionOutcome(rating: Grade): CardCompletionOutcome {
  return RATING_TO_OUTCOME[rating];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Coordinates a brief tactile exit animation before committing a flashcard completion action.
 * Blocks duplicate triggers while exiting and falls back to immediate completion when
 * `prefers-reduced-motion` is enabled.
 */
export function useCardCompletion() {
  const [outcome, setOutcome] = useState<CardCompletionOutcome | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const trigger = useCallback((nextOutcome: CardCompletionOutcome, onComplete: () => void) => {
    if (timerRef.current !== null) return;
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }

    setOutcome(nextOutcome);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setOutcome(null);
      onComplete();
    }, CARD_COMPLETION_DURATION_MS);
  }, []);

  return { outcome, trigger };
}

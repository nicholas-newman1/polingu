import { useCallback, useRef } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { playCardChime } from '../lib/cardFeedback';
import { useCardDeck } from './useCardDeck';
import type { RatingOutcome } from '../lib/ratingColors';

export type CardCompletionOutcome = RatingOutcome | 'next';

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
 * Launches the exit clone and advances to the next card in the same React commit
 * so the outgoing clone and incoming promoted card start animating on the exact same frame.
 */
export function useCardCompletion() {
  const { settings } = useAppSettings();
  const deck = useCardDeck();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const triggeredRef = useRef(false);

  const trigger = useCallback(
    (nextOutcome: CardCompletionOutcome, onComplete: () => void) => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;

      if (settings.autoPlayAudio) {
        playCardChime(nextOutcome);
      }

      if (!prefersReducedMotion() && deck && surfaceRef.current) {
        deck.launchExit(surfaceRef.current, nextOutcome);
      }

      onComplete();
    },
    [deck, settings.autoPlayAudio]
  );

  return {
    surfaceRef,
    promoted: (deck?.transitionId ?? 0) > 0,
    trigger,
  };
}

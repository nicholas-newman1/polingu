import { useCallback, useEffect, useRef } from 'react';
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
 * Launches the exit clone and gives it a paint before playing the optional chime
 * and advancing the review session, so review work cannot hold up its first frame.
 */
export function useCardCompletion() {
  const { settings } = useAppSettings();
  const deck = useCardDeck();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const triggeredRef = useRef(false);
  const pendingCompletionRef = useRef<(() => void) | null>(null);

  // Navigating away must still record a rating made before the deferred update.
  useEffect(() => () => pendingCompletionRef.current?.(), []);

  const trigger = useCallback(
    (nextOutcome: CardCompletionOutcome, onComplete: () => void) => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;

      const complete = () => {
        if (settings.autoPlayAudio) {
          playCardChime(nextOutcome);
        }
        onComplete();
      };

      if (prefersReducedMotion() || !deck || !surfaceRef.current) {
        complete();
        return;
      }

      deck.launchExit(surfaceRef.current, nextOutcome);

      let frame = 0;
      let timeout = 0;
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
        pendingCompletionRef.current = null;
        complete();
      };
      pendingCompletionRef.current = finish;

      // A single rAF runs before paint. The second lets the exit paint first.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(finish);
      });
      // rAF can pause in background tabs; never leave the rating waiting on it.
      timeout = window.setTimeout(finish, 100);
    },
    [deck, settings.autoPlayAudio]
  );

  return {
    surfaceRef,
    promoted: (deck?.transitionId ?? 0) > 0,
    trigger,
  };
}

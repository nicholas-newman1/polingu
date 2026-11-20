import { createContext, useContext } from 'react';
import type { CardCompletionOutcome } from './useCardCompletion';

export interface CardDeckContextValue {
  /** Increments each time a card exits via completion, letting the next card promote seamlessly. */
  transitionId: number;
  /** Clones the completing card's surface into a top exiting layer so the next card can rise beneath it. */
  launchExit: (surfaceEl: HTMLElement | null, outcome: CardCompletionOutcome) => void;
}

export const CardDeckContext = createContext<CardDeckContextValue | null>(null);

export function useCardDeck(): CardDeckContextValue | null {
  return useContext(CardDeckContext);
}

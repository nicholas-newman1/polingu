import { useCallback, useState } from 'react';
import shuffleArray from '../lib/utils/shuffleArray';

interface DeckState<C> {
  active: boolean;
  cards: C[];
  index: number;
}

export interface PracticeDeck<C> {
  active: boolean;
  cards: C[];
  index: number;
  current: C | undefined;
  /** Enters practice mode with a shuffled copy of `cards`, or exits it. */
  toggle: (cards: C[]) => void;
  /** Replaces the deck with a shuffled copy of `cards` without changing mode. */
  reshuffle: (cards: C[]) => void;
  next: () => void;
  update: (predicate: (card: C) => boolean, updater: (card: C) => C) => void;
  /** Removes matching cards; the card after the current one becomes current. */
  remove: (predicate: (card: C) => boolean) => void;
  upcoming: (count: number) => C[];
}

export function usePracticeDeck<C>(): PracticeDeck<C> {
  const [deck, setDeck] = useState<DeckState<C>>({ active: false, cards: [], index: 0 });

  const toggle = useCallback(
    (cards: C[]) => {
      if (deck.active) {
        setDeck((d) => ({ ...d, active: false }));
      } else {
        setDeck({ active: true, cards: shuffleArray(cards), index: 0 });
      }
    },
    [deck.active]
  );

  const reshuffle = useCallback((cards: C[]) => {
    const shuffled = shuffleArray(cards);
    setDeck((d) => ({ ...d, cards: shuffled, index: 0 }));
  }, []);

  const next = useCallback(() => {
    setDeck((d) => ({ ...d, index: d.cards.length ? (d.index + 1) % d.cards.length : 0 }));
  }, []);

  const update = useCallback((predicate: (card: C) => boolean, updater: (card: C) => C) => {
    setDeck((d) => ({ ...d, cards: d.cards.map((c) => (predicate(c) ? updater(c) : c)) }));
  }, []);

  const remove = useCallback((predicate: (card: C) => boolean) => {
    setDeck((d) => {
      const removedBefore = d.cards.slice(0, d.index).filter(predicate).length;
      const cards = d.cards.filter((c) => !predicate(c));
      const index = cards.length ? (d.index - removedBefore) % cards.length : 0;
      return { ...d, cards, index };
    });
  }, []);

  const upcoming = (count: number): C[] => {
    const len = deck.cards.length;
    if (len === 0) return [];
    return Array.from({ length: count }, (_, i) => deck.cards[(deck.index + 1 + i) % len]);
  };

  return {
    active: deck.active,
    cards: deck.cards,
    index: deck.index,
    current: deck.cards[deck.index],
    toggle,
    reshuffle,
    next,
    update,
    remove,
    upcoming,
  };
}

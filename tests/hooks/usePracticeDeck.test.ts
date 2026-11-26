import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import shuffleArray from '../../src/lib/utils/shuffleArray';
import { usePracticeDeck } from '../../src/hooks/usePracticeDeck';

// A predictable "shuffle" (reversal) keeps deck order deterministic and distinct
// from the input order, so the tests can tell a shuffled copy was dealt.
vi.mock('../../src/lib/utils/shuffleArray', () => ({
  default: vi.fn(<T>(cards: T[]) => [...cards].reverse()),
}));

beforeEach(() => {
  vi.mocked(shuffleArray).mockClear();
});

function renderDeck(cards: string[] | null = ['a', 'b', 'c', 'd']) {
  const hook = renderHook(() => usePracticeDeck<string>());
  if (cards) act(() => hook.result.current.toggle(cards));
  const deck = () => hook.result.current;
  return {
    deck,
    next: () => act(() => deck().next()),
    remove: (...ids: string[]) => act(() => deck().remove((c) => ids.includes(c))),
  };
}

describe('usePracticeDeck', () => {
  test('toggling on deals a shuffled copy from the first card; toggling again leaves practice', () => {
    const input = ['a', 'b', 'c'];
    const { deck } = renderDeck(input);

    expect(shuffleArray).toHaveBeenCalledTimes(1);
    expect(deck()).toMatchObject({ active: true, cards: ['c', 'b', 'a'], index: 0, current: 'c' });
    expect(input).toEqual(['a', 'b', 'c']);

    act(() => deck().toggle(input));
    expect(deck().active).toBe(false);
  });

  test('next cycles through the deck and wraps around', () => {
    const { deck, next } = renderDeck(['a', 'b', 'c']);
    const seen = [deck().current];
    for (let i = 0; i < 3; i++) {
      next();
      seen.push(deck().current);
    }
    expect(seen).toEqual(['c', 'b', 'a', 'c']);
  });

  test('removing the current card makes the following card current', () => {
    const { deck, next, remove } = renderDeck(); // d c b a
    next();
    expect(deck().current).toBe('c');
    remove('c');
    expect(deck().current).toBe('b');
    expect(deck().cards).toEqual(['d', 'b', 'a']);
  });

  test('removing a card before the current one keeps the current card', () => {
    const { deck, next, remove } = renderDeck(); // d c b a
    next();
    next();
    expect(deck().current).toBe('b');
    remove('d');
    expect(deck().current).toBe('b');
  });

  test('removing the last card while it is current wraps to the first', () => {
    const { deck, next, remove } = renderDeck(); // d c b a
    next();
    next();
    next();
    expect(deck().current).toBe('a');
    remove('a');
    expect(deck().current).toBe('d');
  });

  test('removing every card leaves an empty deck that stays safe to use', () => {
    const { deck, next, remove } = renderDeck();
    remove('a', 'b', 'c', 'd');
    expect(deck().current).toBeUndefined();
    next();
    expect(deck().index).toBe(0);
    expect(deck().upcoming(3)).toEqual([]);
  });

  test('upcoming lists the cards after the current one, wrapping around', () => {
    const { deck, next } = renderDeck(['a', 'b', 'c']); // c b a
    next();
    expect(deck().upcoming(3)).toEqual(['a', 'c', 'b']);
  });

  test('reshuffle deals a fresh order from the start without leaving practice', () => {
    const { deck, next } = renderDeck(['a', 'b']);
    next();
    act(() => deck().reshuffle(['x', 'y', 'z']));
    expect(deck()).toMatchObject({ active: true, cards: ['z', 'y', 'x'], current: 'z' });
  });

  test('an edit replaces matching cards in place', () => {
    const { deck, next } = renderDeck(['a', 'b', 'c']);
    next();
    act(() =>
      deck().update(
        (c) => c === 'b',
        (c) => c.toUpperCase()
      )
    );
    expect(deck().cards).toEqual(['c', 'B', 'a']);
    expect(deck().current).toBe('B');
  });

  test('turning practice back on deals the cards given at that moment', () => {
    const { deck } = renderDeck(['a', 'b']);
    act(() => deck().toggle([]));
    act(() => deck().toggle(['p', 'q']));
    expect(deck()).toMatchObject({ active: true, cards: ['q', 'p'], current: 'q' });
  });
});

import { describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Rating, type Grade } from 'ts-fsrs';
import { useSessionQueue } from '../../src/hooks/useSessionQueue';

interface Item {
  id: string;
  isNew: boolean;
  reviewData: { version: number };
}

const item = (id: string, isNew = false): Item => ({ id, isNew, reviewData: { version: 0 } });
const items = (ids: string[], isNew = false) => ids.map((id) => item(id, isNew));

function renderQueue(reviewIds: string[], newIds: string[] = []) {
  const hook = renderHook(() => useSessionQueue<Item>());
  act(() =>
    hook.result.current.start({ reviewCards: items(reviewIds), newCards: items(newIds, true) })
  );
  const queue = () => hook.result.current;
  return {
    queue,
    current: () => queue().currentCard?.id,
    rate: (rating: Grade, version = 1) => act(() => queue().rate({ version }, rating)),
  };
}

describe('useSessionQueue', () => {
  test('is empty and unbuilt until started', () => {
    const { result } = renderHook(() => useSessionQueue<Item>());
    expect(result.current.isBuilt).toBe(false);
    expect(result.current.currentCard).toBeUndefined();
    expect(result.current.totalRemaining).toBe(0);
  });

  test('serves review cards before new cards and reports their counts', () => {
    const { queue, current } = renderQueue(['R1', 'R2'], ['N1']);
    expect(current()).toBe('R1');
    expect(queue()).toMatchObject({
      isBuilt: true,
      isFinished: false,
      reviewCount: 2,
      newCount: 1,
      sessionTotal: 3,
      totalRemaining: 3,
    });
  });

  test('the review and new counts fall as cards are passed', () => {
    const { queue, rate } = renderQueue(['R1'], ['N1', 'N2']);
    rate(Rating.Good);
    expect(queue()).toMatchObject({ reviewCount: 0, newCount: 2, totalRemaining: 2 });
    rate(Rating.Again);
    expect(queue()).toMatchObject({ reviewCount: 0, newCount: 2, totalRemaining: 2 });
    rate(Rating.Good);
    expect(queue()).toMatchObject({ reviewCount: 0, newCount: 1, totalRemaining: 1 });
  });

  test('Again cards are retried in the order they failed, after the main queue', () => {
    const { current, rate, queue } = renderQueue(['A', 'B', 'C']);
    rate(Rating.Again);
    rate(Rating.Again);
    rate(Rating.Good);
    expect(current()).toBe('A');
    expect(queue().totalRemaining).toBe(2);

    rate(Rating.Again);
    expect(current()).toBe('B');
    rate(Rating.Good);
    expect(current()).toBe('A');
    rate(Rating.Easy);
    expect(queue().isFinished).toBe(true);
    expect(queue().stats).toEqual({ reviewed: 6, again: 3, hard: 0, good: 2, easy: 1 });
  });

  test('a retried card comes back with the review data from its last rating', () => {
    const { queue, rate } = renderQueue(['A', 'B']);
    rate(Rating.Again, 7);
    rate(Rating.Good);
    expect(queue().currentCard).toEqual({ id: 'A', isNew: false, reviewData: { version: 7 } });
  });

  test('rating after the session has finished changes nothing', () => {
    const { queue, rate } = renderQueue(['A']);
    rate(Rating.Good);
    const finished = queue();
    rate(Rating.Again);
    expect(queue().isFinished).toBe(true);
    expect(queue().stats).toEqual(finished.stats);
    expect(queue().ratingCounter).toBe(finished.ratingCounter);
  });

  test('upcoming lists the next cards in the main queue, then retries', () => {
    const { queue, rate } = renderQueue(['A', 'B', 'C']);
    rate(Rating.Again);
    expect(
      queue()
        .upcoming(5)
        .map(({ id }) => id)
    ).toEqual(['C', 'A']);
    expect(
      queue()
        .upcoming(1)
        .map(({ id }) => id)
    ).toEqual(['C']);

    rate(Rating.Again);
    rate(Rating.Again);
    // Retry phase: A is current, so upcoming starts with the retry after it.
    expect(queue().currentCard?.id).toBe('A');
    expect(
      queue()
        .upcoming(5)
        .map(({ id }) => id)
    ).toEqual(['B', 'C']);
  });

  test('removing a card already rated keeps the current card in place', () => {
    const { queue, rate, current } = renderQueue(['A', 'B', 'C']);
    rate(Rating.Good);
    act(() => queue().remove(({ id }) => id === 'A'));
    expect(current()).toBe('B');
    expect(queue().totalRemaining).toBe(2);
  });

  test('removing the current card during the retry phase moves to the next retry', () => {
    const { queue, rate, current } = renderQueue(['A', 'B']);
    rate(Rating.Again);
    rate(Rating.Again);
    expect(current()).toBe('A');

    act(() => queue().remove(({ id }) => id === 'A'));
    expect(current()).toBe('B');
    expect(queue().totalRemaining).toBe(1);
  });

  test('re-assessing a passed card as Again restores it as a retry with the new data', () => {
    const { queue, rate, current } = renderQueue(['A', 'B']);
    rate(Rating.Good);
    rate(Rating.Good);
    expect(queue().isFinished).toBe(true);

    act(() => queue().reassess(({ id }) => id === 'A', { version: 9 }, true));
    expect(queue().isFinished).toBe(false);
    expect(queue().currentCard).toEqual({ id: 'A', isNew: false, reviewData: { version: 9 } });
    // Re-assessing is a correction, not another rating.
    expect(queue().stats.reviewed).toBe(2);
    rate(Rating.Good);
    expect(current()).toBeUndefined();
  });

  test('re-assessing a card not yet reached does not add a retry', () => {
    const { queue } = renderQueue(['A', 'B']);
    act(() => queue().reassess(({ id }) => id === 'B', { version: 9 }, true));
    expect(queue().totalRemaining).toBe(2);
  });

  test('an edit applies to the card in the main queue and in its pending retry', () => {
    const { queue, rate } = renderQueue(['A', 'B']);
    rate(Rating.Again, 3);
    act(() => queue().update((it) => (it.id === 'A' ? { ...it, id: 'A2' } : it)));

    rate(Rating.Good);
    // The retry keeps its review data from the Again rating.
    expect(queue().currentCard).toEqual({ id: 'A2', isNew: false, reviewData: { version: 3 } });
  });

  test('starting again replaces the cards and clears retries and stats', () => {
    const { queue, rate, current } = renderQueue(['A']);
    rate(Rating.Again);
    act(() =>
      queue().start({ reviewCards: [], newCards: items(['X'], true) }, { isPracticeAhead: true })
    );

    expect(current()).toBe('X');
    expect(queue()).toMatchObject({
      totalRemaining: 1,
      reviewCount: 0,
      newCount: 1,
      isPracticeAhead: true,
      stats: { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 },
    });
  });
});

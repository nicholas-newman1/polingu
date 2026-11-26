import { beforeEach, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createEmptyCard, Rating, type Card } from 'ts-fsrs';
import { useRatingIntervals } from '../../src/hooks/useRatingIntervals';
import { fsrsCard, inDays, State } from '../helpers/fsrs';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
});

const render = (initial: Card | undefined) =>
  renderHook(({ card }) => useRatingIntervals(card), { initialProps: { card: initial } });

test('a new card offers minutes for Again, Hard and Good and days for Easy', () => {
  const { result } = render(createEmptyCard());
  expect(result.current).toEqual({
    [Rating.Again]: '1m',
    [Rating.Hard]: '6m',
    [Rating.Good]: '10m',
    [Rating.Easy]: '8d',
  });
});

test('a mature review card offers longer intervals the better the rating', () => {
  const card = fsrsCard(State.Review, inDays(0), {
    stability: 20,
    difficulty: 5,
    reps: 6,
    scheduled_days: 20,
    last_review: inDays(-20),
  });
  const { result } = render(card);
  const days = (label: string) => (label.endsWith('d') ? parseInt(label, 10) : 0);
  const intervals = result.current!;

  expect(intervals[Rating.Again]).toMatch(/m$/);
  expect(days(intervals[Rating.Hard])).toBeGreaterThan(1);
  expect(days(intervals[Rating.Good])).toBeGreaterThan(days(intervals[Rating.Hard]));
  expect(days(intervals[Rating.Easy])).toBeGreaterThan(days(intervals[Rating.Good]));
});

test('there are no intervals without a card', () => {
  expect(render(undefined).result.current).toBeUndefined();
});

test('intervals are kept across renders of the same card and recomputed for a new one', () => {
  const first = createEmptyCard();
  const { result, rerender } = render(first);
  const initial = result.current;

  rerender({ card: first });
  expect(result.current).toBe(initial);

  rerender({ card: fsrsCard(State.Review, inDays(0), { stability: 20, difficulty: 5, reps: 6 }) });
  expect(result.current).not.toEqual(initial);
});

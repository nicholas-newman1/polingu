import { beforeEach, describe, expect, test } from 'vitest';
import { createEmptyCard, Rating, type Card } from 'ts-fsrs';
import formatInterval from '../../src/lib/fsrsUtils/formatInterval';
import getNextIntervals from '../../src/lib/fsrsUtils/getNextIntervals';
import rateCard from '../../src/lib/fsrsUtils/rateCard';
import forgetCard from '../../src/lib/fsrsUtils/forgetCard';
import isDue from '../../src/lib/fsrsUtils/isDue';
import getReviewBucket from '../../src/lib/fsrsUtils/getReviewBucket';
import { DAY, freezeTime, graduated, inMinutes, learning, NOW, State } from './fixtures';
import { fsrsCard } from '../helpers/fsrs';

beforeEach(() => freezeTime());

const dueIn = (ms: number) => fsrsCard(State.Review, new Date(NOW.getTime() + ms));
const MINUTE = 60_000;
/** Due dates come back from storage as ISO strings until deserialised. */
const withStringDue = (card: Card, due: Date) =>
  ({ ...card, due: due.toISOString() }) as unknown as Card;
const HOUR = 60 * MINUTE;

describe('formatInterval', () => {
  test.each([
    ['already overdue', -3 * DAY, '<1m'],
    ['due now', 0, '<1m'],
    ['29 seconds', 29_000, '<1m'],
    ['31 seconds, rounded up', 31_000, '1m'],
    ['10 minutes', 10 * MINUTE, '10m'],
    ['59 minutes', 59 * MINUTE, '59m'],
    ['59 minutes 40 seconds, rounded up', 59 * MINUTE + 40_000, '1h'],
    ['5 hours', 5 * HOUR, '5h'],
    ['23 hours', 23 * HOUR, '23h'],
    ['23 hours 40 minutes, rounded up', 23 * HOUR + 40 * MINUTE, '1d'],
    ['36 hours, rounded up', 36 * HOUR, '2d'],
    ['8 days', 8 * DAY, '8d'],
    ['a year', 365 * DAY, '365d'],
  ])('%s shows as %s', (_, ms, expected) => {
    expect(formatInterval(dueIn(ms), NOW)).toBe(expected);
  });

  test('reads a due date stored as a string, as it comes back from storage', () => {
    const card = withStringDue(dueIn(0), new Date(NOW.getTime() + 3 * DAY));
    expect(formatInterval(card, NOW)).toBe('3d');
  });

  test('measures from the current time by default', () => {
    expect(formatInterval(dueIn(2 * HOUR))).toBe('2h');
  });
});

describe('getNextIntervals', () => {
  test('for a new card, shows the learning steps and the first graduating interval', () => {
    expect(getNextIntervals(createEmptyCard(NOW), NOW)).toEqual({
      [Rating.Again]: '1m',
      [Rating.Hard]: '6m',
      [Rating.Good]: '10m',
      [Rating.Easy]: '8d',
    });
  });

  test('for a due review, Again relearns in minutes and the others grow with the rating', () => {
    const intervals = getNextIntervals(graduated(0), NOW);
    const days = (label: string) => Number(label.replace('d', ''));

    expect(intervals[Rating.Again]).toBe('10m');
    expect(intervals[Rating.Hard]).toMatch(/^\d+d$/);
    expect(days(intervals[Rating.Hard])).toBeLessThan(days(intervals[Rating.Good]));
    expect(days(intervals[Rating.Good])).toBeLessThan(days(intervals[Rating.Easy]));
  });

  test('matches the due date each rating would actually schedule', () => {
    const card = graduated(-2);
    const intervals = getNextIntervals(card, NOW);
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
      expect(intervals[rating]).toBe(
        formatInterval(rateCard({ fsrsCard: card }, rating, NOW).fsrsCard, NOW)
      );
    }
  });
});

describe('rateCard', () => {
  test('returns new review data with the rated card, keeping the other fields', () => {
    const before: { wordId: string; note: string; fsrsCard: Card } = {
      wordId: 'custom_1',
      note: 'kept',
      fsrsCard: createEmptyCard(NOW),
    };
    const after = rateCard(before, Rating.Good, NOW);

    expect(after.wordId).toBe('custom_1');
    expect(after.note).toBe('kept');
    expect(after.fsrsCard.state).toBe(State.Learning);
    expect(after.fsrsCard.due).toEqual(inMinutes(10));
    expect(after).not.toHaveProperty('log');
    expect(before.fsrsCard.state).toBe(State.New);
  });

  test('a new card rated Easy graduates straight away', () => {
    const after = rateCard({ fsrsCard: createEmptyCard(NOW) }, Rating.Easy, NOW);
    expect(after.fsrsCard.state).toBe(State.Review);
    expect(after.fsrsCard.due.getTime() - NOW.getTime()).toBe(8 * DAY);
  });

  test('a review card rated Again lapses into relearning', () => {
    const after = rateCard({ fsrsCard: graduated(-1) }, Rating.Again, NOW);
    expect(after.fsrsCard.state).toBe(State.Relearning);
    expect(after.fsrsCard.lapses).toBe(1);
    expect(after.fsrsCard.due).toEqual(inMinutes(10));
  });
});

describe('forgetCard', () => {
  test('resets a studied card to new, due now, so it is scheduled as new again', () => {
    const studied = { wordId: 4, fsrsCard: graduated(30) };
    const forgotten = forgetCard(studied, NOW);

    expect(forgotten.wordId).toBe(4);
    expect(forgotten.fsrsCard.state).toBe(State.New);
    expect(forgotten.fsrsCard.due).toEqual(NOW);
    expect(getReviewBucket(forgotten.fsrsCard, false, false)).toBe('new');
    expect(forgotten).not.toHaveProperty('log');
    expect(studied.fsrsCard.state).toBe(State.Review);
  });
});

describe('isDue', () => {
  test('a card is due from the instant of its due date, never before', () => {
    expect(isDue(dueIn(0))).toBe(true);
    expect(isDue(dueIn(-1))).toBe(true);
    expect(isDue(dueIn(1))).toBe(false);
  });

  test('a learning card is due by its step, and an unseen card is never due', () => {
    expect(isDue(learning(-1))).toBe(true);
    expect(isDue(learning(1))).toBe(false);
    expect(isDue(createEmptyCard(new Date(NOW.getTime() - DAY)))).toBe(false);
  });

  test('a due date stored as a string is compared as a date', () => {
    expect(isDue(withStringDue(dueIn(0), new Date(NOW.getTime() - DAY)))).toBe(true);
    expect(isDue(withStringDue(dueIn(0), new Date(NOW.getTime() + DAY)))).toBe(false);
  });
});

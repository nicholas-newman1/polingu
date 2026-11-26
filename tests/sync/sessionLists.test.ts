import { describe, expect, test } from 'vitest';
import {
  mergeSessionDocs,
  removeFromDayLists,
  setInSessionList,
  startDayIfNeeded,
} from '../../src/lib/reviewSession/sessionLists';

const DAY = '2026-11-26';
const doc = (
  reviewedToday: (string | number)[],
  changedAt?: Record<string, number>,
  lastReviewDate = DAY
) => ({ reviewedToday, newCardsToday: [] as (string | number)[], lastReviewDate, changedAt });

describe('merging two copies of the same day', () => {
  test('without stamps (data saved before them), the lists are combined', () => {
    expect(mergeSessionDocs(doc([1, 2]), doc([2, 3]))).toMatchObject({ reviewedToday: [1, 2, 3] });
  });

  test('a removal made here survives a server copy that still lists the id', () => {
    const local = setInSessionList(doc([1]), 'reviewedToday', 1, false, 200);

    expect(mergeSessionDocs(doc([1, 2]), local)).toMatchObject({ reviewedToday: [2] });
  });

  test('a removal made on another device survives this device saving a stale copy', () => {
    const server = setInSessionList(doc([1]), 'reviewedToday', 1, false, 300);
    const stale = setInSessionList(doc([]), 'reviewedToday', 1, true, 100);

    expect(mergeSessionDocs(server, stale)).toMatchObject({ reviewedToday: [] });
  });

  test('an id added back after being removed is kept', () => {
    const server = setInSessionList(doc([1]), 'reviewedToday', 1, false, 200);
    const readded = setInSessionList(server, 'reviewedToday', 1, true, 300);

    expect(mergeSessionDocs(server, readded)).toMatchObject({ reviewedToday: [1] });
  });

  test("ids only one device touched keep that device's answer, and stamps keep the latest time", () => {
    const server = setInSessionList(doc([]), 'reviewedToday', 'a', true, 100);
    const local = setInSessionList(doc([]), 'reviewedToday', 'b', true, 150);

    const merged = mergeSessionDocs(server, local) as ReturnType<typeof doc>;

    expect(merged.reviewedToday).toEqual(['a', 'b']);
    expect(merged.changedAt).toEqual({ 'reviewedToday:a': 100, 'reviewedToday:b': 150 });
  });

  test('numeric and string forms of the same id are one id', () => {
    const local = setInSessionList(doc([]), 'reviewedToday', '5', false, 200);

    expect(mergeSessionDocs(doc([5]), local)).toMatchObject({ reviewedToday: [] });
  });

  test('copies from different days are not merged: the later day wins', () => {
    const yesterday = doc([1], undefined, '2026-11-25');
    const today = doc([2]);

    expect(mergeSessionDocs(yesterday, today)).toBe(today);
    expect(mergeSessionDocs(today, yesterday)).toBe(today);
  });
});

describe('changing the lists', () => {
  test('adding an id already present keeps one copy but records the change', () => {
    const next = setInSessionList(doc([1]), 'reviewedToday', 1, true, 50);

    expect(next.reviewedToday).toEqual([1]);
    expect(next.changedAt).toEqual({ 'reviewedToday:1': 50 });
  });

  test('"Review again" takes the card out of both lists', () => {
    const store = { ...doc([7, 8]), newCardsToday: [7] };

    const next = removeFromDayLists(store, 7, 60);

    expect(next).toMatchObject({ reviewedToday: [8], newCardsToday: [] });
    expect(next.changedAt).toEqual({ 'reviewedToday:7': 60, 'newCardsToday:7': 60 });
  });

  test('a store from an earlier day starts the new day empty', () => {
    const old = setInSessionList(doc([1], undefined, '2026-11-25'), 'reviewedToday', 2, true, 10);

    expect(startDayIfNeeded(old, ['reviewedToday', 'newCardsToday'], DAY)).toEqual({
      reviewedToday: [],
      newCardsToday: [],
      lastReviewDate: DAY,
      changedAt: {},
    });
  });

  test("today's store is left as it is", () => {
    const today = doc([1]);
    expect(startDayIfNeeded(today, ['reviewedToday'], DAY)).toBe(today);
  });
});

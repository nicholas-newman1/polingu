import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { prefetchAudio } from '../../src/lib/audio/audioPrefetchCache';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import {
  emptyStore,
  entry,
  lastSaved,
  makeWords,
  renderReviewSession,
  SAVE_DELAY_MS,
} from './support/reviewSession';

// Audio prefetching goes to the network; the session only needs to ask for it.
vi.mock('../../src/lib/audio/audioPrefetchCache', () => ({
  prefetchAudio: vi.fn(),
  resolvePlayableAudioUrl: (url: string) => url,
}));

// The practice deck is shuffled; a reversal keeps its order predictable.
vi.mock('../../src/lib/utils/shuffleArray', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/utils/shuffleArray')>()),
  default: <T>(items: T[]) => [...items].reverse(),
}));

/** A graduated card, due `days` from now (negative: overdue). */
const reviewCard = (days: number) =>
  fsrsCard(State.Review, inDays(days), {
    stability: 10,
    difficulty: 5,
    reps: 3,
    scheduled_days: 10,
    last_review: inDays(days - 10),
  });

const NEW_CARD_INTERVALS = {
  [Rating.Again]: '1m',
  [Rating.Hard]: '6m',
  [Rating.Good]: '10m',
  [Rating.Easy]: '8d',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
});

describe('building the session', () => {
  test('waits for data, then starts with due reviews ahead of new cards', async () => {
    const h = renderReviewSession({
      words: makeWords('N1', 'R', 'N2'),
      stores: {
        'pl-to-en': emptyStore({ cards: Object.fromEntries([entry('R', reviewCard(-1))]) }),
      },
      ready: false,
    });
    await h.settle();
    expect(h.session().isBuilt).toBe(false);
    expect(h.session().currentCard).toBeUndefined();

    h.rerender({ direction: 'pl-to-en', ready: true });
    await h.settle();

    expect(h.session().isBuilt).toBe(true);
    expect(h.currentId()).toBe('R');
    expect(h.session()).toMatchObject({ reviewCount: 1, newCount: 2, totalRemaining: 3 });
    expect(h.session().isFinished).toBe(false);
  });

  test('an empty deck is a finished session, and rating it saves nothing', async () => {
    const h = renderReviewSession({ words: [] });
    await h.settle();

    expect(h.session().isBuilt).toBe(true);
    expect(h.session().isFinished).toBe(true);
    expect(h.session().intervals).toEqual({ 1: '', 2: '', 3: '', 4: '' });

    h.rate(Rating.Good);
    h.waitForSave();
    h.unmount();
    expect(h.saves).not.toHaveBeenCalled();
  });

  test('a session is built only once per direction while the data keeps changing', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Again);
    h.waitForSave();
    await h.settle();

    // The saved store changed, but the running session must not restart: a rebuild
    // would serve the failed card A first and forget the history.
    expect(h.currentId()).toBe('B');
    expect(h.session().history.canGoBack).toBe(true);
  });
});

describe('rating a card', () => {
  test('Good shows the next card at once and saves the review once, after the exit delay', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();

    h.rate(Rating.Good);
    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(1);

    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
    expect(h.saves).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(h.saves).toHaveBeenCalledTimes(1);

    const saved = lastSaved(h.saves);
    expect(saved.cards.A.fsrsCard.reps).toBe(1);
    expect(saved.cards.A.fsrsCard.state).toBe(State.Learning);
    expect(saved.reviewedToday).toEqual(['A']);
    expect(saved.newCardsToday).toEqual(['A']);
    expect(saved.cards.B).toBeUndefined();

    act(() => vi.advanceTimersByTime(10 * SAVE_DELAY_MS));
    h.unmount();
    expect(h.saves).toHaveBeenCalledTimes(1);
  });

  test('ratings in quick succession are saved together, losing neither', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B', 'C') });
    await h.settle();

    h.rate(Rating.Good);
    act(() => vi.advanceTimersByTime(300));
    h.rate(Rating.Easy);
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1));
    expect(h.saves).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(h.saves).toHaveBeenCalledTimes(1);
    const saved = lastSaved(h.saves);
    expect(Object.keys(saved.cards).sort()).toEqual(['A', 'B']);
    expect(saved.reviewedToday).toEqual(['A', 'B']);
    expect(h.store().cards.B.fsrsCard.state).toBe(State.Review);
  });

  test('Again keeps a new card in the session until it is passed, introducing it only once', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();

    h.rate(Rating.Again);
    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(2);
    h.rate(Rating.Good);
    expect(h.currentId()).toBe('A');
    expect(h.session().isFinished).toBe(false);
    h.waitForSave();

    let saved = lastSaved(h.saves);
    expect(saved.newCardsToday).toEqual(['A', 'B']);
    expect(saved.reviewedToday).toEqual(['B']);
    expect(saved.cards.A.fsrsCard.state).toBe(State.Learning);

    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
    h.waitForSave();

    saved = lastSaved(h.saves);
    expect(saved.newCardsToday).toEqual(['A', 'B']);
    expect(saved.reviewedToday).toEqual(['B', 'A']);
    expect(saved.cards.A.fsrsCard.reps).toBe(2);
  });

  test('Again on a due review card records a lapse and retries it before the session ends', async () => {
    const h = renderReviewSession({
      words: makeWords('R'),
      stores: {
        'pl-to-en': emptyStore({ cards: Object.fromEntries([entry('R', reviewCard(-2))]) }),
      },
    });
    await h.settle();

    h.rate(Rating.Again);
    expect(h.currentId()).toBe('R');
    expect(h.session().isFinished).toBe(false);
    h.waitForSave();

    let saved = lastSaved(h.saves);
    expect(saved.cards.R.fsrsCard.state).toBe(State.Relearning);
    expect(saved.cards.R.fsrsCard.lapses).toBe(1);
    expect(saved.reviewedToday).toEqual([]);
    expect(saved.newCardsToday).toEqual([]);

    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
    h.waitForSave();
    saved = lastSaved(h.saves);
    expect(saved.reviewedToday).toEqual(['R']);
    expect(saved.newCardsToday).toEqual([]);
  });

  test('repeated Again ratings keep cycling the card without finishing the session', async () => {
    const h = renderReviewSession({ words: makeWords('A') });
    await h.settle();

    for (let i = 0; i < 3; i++) {
      h.rate(Rating.Again);
      expect(h.currentId()).toBe('A');
      expect(h.session().totalRemaining).toBe(1);
      expect(h.session().isFinished).toBe(false);
    }
    h.rate(Rating.Hard);
    expect(h.session().isFinished).toBe(true);
    expect(h.session().totalRemaining).toBe(0);
    expect(h.session().finishedStateProps.sessionStats).toEqual({
      reviewed: 4,
      again: 3,
      hard: 1,
      good: 0,
      easy: 0,
    });
  });

  test('the rating buttons show the current card intervals, and nothing once finished', async () => {
    const h = renderReviewSession({ words: makeWords('A') });
    await h.settle();
    expect(h.session().intervals).toEqual(NEW_CARD_INTERVALS);

    h.rate(Rating.Easy);
    expect(h.session().intervals).toEqual({ 1: '', 2: '', 3: '', 4: '' });
  });

  test('a session left open across the spring-forward night schedules each card from when it was rated', async () => {
    vi.setSystemTime(new Date('2026-03-08T01:55:00-05:00')); // 01:55 EST, DST starts at 02:00
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    const firstRating = Date.now();
    h.rate(Rating.Good);

    act(() => vi.advanceTimersByTime(10 * 60_000)); // now 03:05 EDT
    const secondRating = Date.now();
    h.rate(Rating.Good);
    h.waitForSave();

    const { cards } = lastSaved(h.saves);
    const tenMinutes = 10 * 60_000;
    expect(cards.A.fsrsCard.due.getTime()).toBe(firstRating + tenMinutes);
    expect(cards.B.fsrsCard.due.getTime()).toBe(secondRating + tenMinutes);
    expect(cards.B.fsrsCard.last_review?.getTime()).toBe(secondRating);
  });
});

describe('stepping back through history', () => {
  test('shows the previous card with the intervals it offered before it was rated', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    expect(h.session().history.canGoBack).toBe(false);

    h.rate(Rating.Good);
    expect(h.session().reassessIntervals).toBeUndefined();
    h.goBack();

    expect(h.session().history.historyCard?.id).toBe('A');
    expect(h.session().reassessIntervals).toEqual(NEW_CARD_INTERVALS);
    // The live session is untouched while looking back.
    expect(h.currentId()).toBe('B');
  });

  test('re-rating a card replaces its saved review instead of adding another', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);
    h.waitForSave();
    expect(lastSaved(h.saves).cards.A.fsrsCard.state).toBe(State.Learning);

    h.goBack();
    h.reassess(Rating.Easy);
    expect(h.session().history.isViewingHistory).toBe(false);
    expect(h.currentId()).toBe('B');
    h.waitForSave();

    const saved = lastSaved(h.saves);
    expect(saved.cards.A.fsrsCard.reps).toBe(1);
    expect(saved.cards.A.fsrsCard.state).toBe(State.Review);
    expect(saved.newCardsToday).toEqual(['A']);
    expect(saved.reviewedToday).toEqual(['A']);
    expect(h.session().finishedStateProps.sessionStats.reviewed).toBe(1);
  });

  test('re-rating a passed card as Again brings it back, even after the session finished', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);
    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);

    h.goBack();
    h.goBack();
    expect(h.session().history.historyCard?.id).toBe('A');
    h.reassess(Rating.Again);
    expect(h.session().isFinished).toBe(false);
    expect(h.session().history.historyCard?.id).toBe('B');

    h.goForward();
    expect(h.currentId()).toBe('A');
    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
    h.waitForSave();

    // One Again from the re-rating, one Good after it: the first Good was replaced.
    expect(lastSaved(h.saves).cards.A.fsrsCard.reps).toBe(2);
  });

  test('re-rating a card as Again twice leaves a single retry', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);

    h.goBack();
    h.reassess(Rating.Again);
    h.goBack();
    h.reassess(Rating.Again);

    expect(h.session().totalRemaining).toBe(2);
    h.rate(Rating.Good);
    expect(h.currentId()).toBe('A');
    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
  });

  test('re-rating an Again card as Good drops its pending retry', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Again);

    h.goBack();
    h.reassess(Rating.Good);
    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(1);

    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
  });

  test('a card re-rated Good after Again stays out of a rebuilt session', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Again);
    h.goBack();
    h.reassess(Rating.Good);
    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);

    act(() => h.session().restartAfterRender());
    await h.settle();

    expect(h.currentId()).toBeUndefined();
    expect(lastSaved(h.saves).reviewedToday).toContain('A');
  });
});

describe('saving reviews', () => {
  test('leaving the page saves a pending review immediately', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);

    h.unmount();
    expect(h.saves).toHaveBeenCalledTimes(1);
    expect(lastSaved(h.saves).cards.A.fsrsCard.reps).toBe(1);

    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS));
    expect(h.saves).toHaveBeenCalledTimes(1);
  });

  test('closing the tab (pagehide) saves a pending review immediately, and only once', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);

    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(h.saves).toHaveBeenCalledTimes(1);
    expect(lastSaved(h.saves).reviewedToday).toEqual(['A']);

    h.waitForSave();
    expect(h.saves).toHaveBeenCalledTimes(1);
  });

  test('switching direction saves pending reviews to the direction they were made in', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);
    h.rate(Rating.Good);

    h.switchDirection('en-to-pl');
    expect(h.saves).toHaveBeenCalledTimes(1);
    expect(h.saves).toHaveBeenLastCalledWith('pl-to-en', expect.anything());
    expect(Object.keys(h.store('pl-to-en').cards).sort()).toEqual(['A', 'B']);

    await h.settle();
    // A fresh session for the other direction, where nothing has been studied yet.
    expect(h.currentId()).toBe('A');
    expect(h.session().totalRemaining).toBe(2);
    expect(h.session().history.canGoBack).toBe(false);

    h.rate(Rating.Easy);
    h.waitForSave();
    const saved = lastSaved(h.saves, 'en-to-pl');
    expect(Object.keys(saved.cards)).toEqual(['A']);
    expect(saved.cards.A.fsrsCard.reps).toBe(1);
    expect(h.store('pl-to-en').cards.A.fsrsCard.state).toBe(State.Learning);
  });

  test('a rating made while the previous save is still landing builds on it', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B', 'C'), deferCommits: true });
    await h.settle();

    h.rate(Rating.Good);
    h.waitForSave();
    h.rate(Rating.Hard);
    h.commitPendingSaves();
    h.rate(Rating.Easy);
    h.waitForSave();

    const saved = lastSaved(h.saves);
    expect(Object.keys(saved.cards).sort()).toEqual(['A', 'B', 'C']);
    expect(saved.reviewedToday).toEqual(['A', 'B', 'C']);
  });

  test('after the store is reset from outside, new ratings build on the reset store', async () => {
    const h = renderReviewSession({
      words: makeWords('A', 'Z'),
      stores: {
        'pl-to-en': emptyStore({
          cards: Object.fromEntries([entry('A', reviewCard(3)), entry('Z', reviewCard(30))]),
        }),
      },
    });
    await h.settle();
    expect(h.session().isFinished).toBe(true);

    h.replaceStore('pl-to-en', emptyStore());
    act(() => h.session().restartAfterRender());
    await h.settle();
    expect(h.currentId()).toBe('A');
    expect(h.session().newCount).toBe(2);

    h.rate(Rating.Good);
    h.waitForSave();
    const saved = lastSaved(h.saves);
    expect(Object.keys(saved.cards)).toEqual(['A']);
    expect(saved.cards.A.fsrsCard.reps).toBe(1);
  });

  test('a store update that lands while a rating waits to be saved is kept', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);

    const synced = emptyStore({
      cards: Object.fromEntries([entry('X', reviewCard(5))]),
      reviewedToday: ['X'],
    });
    h.replaceStore('pl-to-en', synced);
    h.waitForSave();

    const saved = lastSaved(h.saves);
    expect(saved.cards.A.fsrsCard.reps).toBe(1);
    expect(saved.cards.X).toEqual(synced.cards.X);
    expect([...saved.reviewedToday].sort()).toEqual(['A', 'X']);
  });

  test('under StrictMode a rating is still saved exactly once', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B'), strictMode: true });
    await h.settle();
    expect(h.session().totalRemaining).toBe(2);

    h.rate(Rating.Good);
    h.waitForSave();
    h.unmount();
    expect(h.saves).toHaveBeenCalledTimes(1);
  });
});

describe('rebuilding and extra rounds', () => {
  test('rebuilding right after a rating saves it first and leaves the rated card out', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Good);

    act(() => h.session().restartAfterRender());
    expect(h.saves).toHaveBeenCalledTimes(1);
    await h.settle();

    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(1);
  });

  test('practice ahead starts a flagged round of the nearest not-yet-due cards', async () => {
    const h = renderReviewSession({
      words: makeWords('P', 'Q', 'S'),
      stores: {
        'pl-to-en': emptyStore({
          cards: Object.fromEntries([
            entry('P', reviewCard(5)),
            entry('Q', reviewCard(2)),
            entry('S', reviewCard(9)),
          ]),
        }),
      },
    });
    await h.settle();
    expect(h.session().isFinished).toBe(true);

    act(() => h.session().finishedStateProps.setPracticeAheadCount(2));
    act(() => h.session().finishedStateProps.onPracticeAhead());

    expect(h.session().isPracticeAhead).toBe(true);
    expect(h.session().totalRemaining).toBe(2);
    expect(h.currentId()).toBe('Q');

    h.rate(Rating.Good);
    expect(h.currentId()).toBe('P');
    h.waitForSave();
    const saved = lastSaved(h.saves);
    expect(saved.cards.Q.fsrsCard.reps).toBe(4);
    expect(saved.reviewedToday).toEqual(['Q']);
    expect(saved.newCardsToday).toEqual([]);
  });

  test('learning extra starts a round of unseen cards beyond the daily limit', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B', 'C', 'D'), newCardsPerDay: 1 });
    await h.settle();
    expect(h.session().totalRemaining).toBe(1);
    h.rate(Rating.Good);
    h.waitForSave();
    expect(h.session().isFinished).toBe(true);

    act(() => h.session().finishedStateProps.setExtraNewCardsCount(2));
    act(() => h.session().finishedStateProps.onLearnExtra());

    expect(h.session()).toMatchObject({ isPracticeAhead: false, newCount: 2, totalRemaining: 2 });
    expect(h.currentId()).toBe('B');
    h.rate(Rating.Good);
    h.waitForSave();
    expect(lastSaved(h.saves).newCardsToday).toEqual(['A', 'B']);
  });

  test('learning extra right after the last rating does not offer the card just learned', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B'), newCardsPerDay: 1 });
    await h.settle();
    h.rate(Rating.Good);

    act(() => h.session().finishedStateProps.onLearnExtra());

    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(1);
  });

  test('another practice round right after the last rating does not repeat that card', async () => {
    const h = renderReviewSession({
      words: makeWords('P', 'Q'),
      stores: {
        'pl-to-en': emptyStore({
          cards: Object.fromEntries([entry('P', reviewCard(5)), entry('Q', reviewCard(2))]),
        }),
      },
    });
    await h.settle();
    act(() => h.session().finishedStateProps.setPracticeAheadCount(1));
    act(() => h.session().finishedStateProps.onPracticeAhead());
    expect(h.currentId()).toBe('Q');
    h.rate(Rating.Good);

    act(() => h.session().finishedStateProps.onPracticeAhead());

    expect(h.currentId()).toBe('P');
  });
});

describe('editing cards mid-session', () => {
  test('an edit reaches the current card, the practice deck and history', async () => {
    const words = makeWords('A', 'B', 'C');
    const h = renderReviewSession({ words });
    await h.settle();
    h.rate(Rating.Good);
    act(() => h.session().practice.toggle(words));

    act(() =>
      h.session().updateCards(
        (word) => word.id === 'A' || word.id === 'B',
        (word) => ({ ...word, english: `${word.english} (edited)` })
      )
    );

    expect(h.session().currentCard?.word.english).toBe('en-B (edited)');
    expect(h.session().history.history.map((word) => word.english)).toEqual(['en-A (edited)']);
    expect(
      Object.fromEntries(h.session().practice.cards.map((word) => [word.id, word.english]))
    ).toEqual({ A: 'en-A (edited)', B: 'en-B (edited)', C: 'en-C' });
  });

  test('deleting the current card moves on to the next one', async () => {
    const words = makeWords('A', 'B', 'C');
    const h = renderReviewSession({ words });
    await h.settle();

    act(() => h.session().removeCards((word) => word.id === 'A'));
    expect(h.currentId()).toBe('B');
    expect(h.session().totalRemaining).toBe(2);
  });

  test('deleting a card that is waiting for a retry removes the retry', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B') });
    await h.settle();
    h.rate(Rating.Again);

    act(() => h.session().removeCards((word) => word.id === 'A'));
    h.rate(Rating.Good);
    expect(h.session().isFinished).toBe(true);
  });
});

describe('audio prefetching', () => {
  const prefetched = () => vi.mocked(prefetchAudio).mock.calls.map(([url]) => url);

  test('prefetches audio for the next three cards in the session', async () => {
    const h = renderReviewSession({ words: makeWords('A', 'B', 'C', 'D', 'E') });
    await h.settle();
    expect(prefetched()).toEqual(['audio/B.mp3', 'audio/C.mp3', 'audio/D.mp3']);

    h.rate(Rating.Good);
    expect(prefetched()).toContain('audio/E.mp3');
    expect(prefetched()).not.toContain('audio/A.mp3');
  });

  test('in practice mode prefetches the upcoming practice cards instead', async () => {
    const words = makeWords('A', 'B', 'C', 'D');
    const h = renderReviewSession({ words });
    await h.settle();
    vi.mocked(prefetchAudio).mockClear();

    act(() => h.session().practice.toggle(words)); // deck D C B A

    expect(h.session().practice.current?.id).toBe('D');
    expect(prefetched()).toEqual(['audio/C.mp3', 'audio/B.mp3', 'audio/A.mp3']);
  });
});

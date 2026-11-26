import { describe, expect, test } from 'vitest';
import { Rating, type Grade } from 'ts-fsrs';
import {
  createSessionQueueState,
  getCurrentSessionCard,
  getRemainingCount,
  getUpcomingSessionCards,
  isSessionFinished,
  sessionQueueReducer,
  type SessionCards,
  type SessionQueueAction,
  type SessionQueueState,
} from '../../src/lib/reviewSession/sessionQueue';

/** A session card whose review data records how often it was rated. */
interface Item {
  id: string;
  label?: string;
  reviewData: { attempts: number };
}

const item = (id: string): Item => ({ id, reviewData: { attempts: 0 } });
const is = (id: string) => (i: Item) => i.id === id;

type State = SessionQueueState<Item>;
const reduce = (state: State, action: SessionQueueAction<Item>) =>
  sessionQueueReducer(state, action);

function start(cards: SessionCards<Item>, isPracticeAhead = false): State {
  return reduce(createSessionQueueState<Item>(), { type: 'start', cards, isPracticeAhead });
}

/** Rates whatever card is current, as the review screen does. */
function rate(state: State, rating: Grade): State {
  const current = getCurrentSessionCard(state);
  const attempts = (current?.reviewData.attempts ?? 0) + 1;
  return reduce(state, { type: 'rate', reviewData: { attempts }, rating });
}

const currentId = (state: State) => getCurrentSessionCard(state)?.id;

/** Rates cards in turn with the given ratings and returns the ids in the order shown. */
function play(state: State, ratings: Grade[]): { shown: string[]; state: State } {
  const shown: string[] = [];
  for (const rating of ratings) {
    shown.push(currentId(state)!);
    state = rate(state, rating);
  }
  return { shown, state };
}

const twoReviewsTwoNew = () =>
  start({ reviewCards: [item('r1'), item('r2')], newCards: [item('n1'), item('n2')] });

describe('building a session', () => {
  test('due reviews are shown before new cards, and the counts describe the session', () => {
    const state = twoReviewsTwoNew();

    expect(state.isBuilt).toBe(true);
    expect(state.sessionQueue.map((i) => i.id)).toEqual(['r1', 'r2', 'n1', 'n2']);
    expect(state.reviewCount).toBe(2);
    expect(state.newCount).toBe(2);
    expect(currentId(state)).toBe('r1');
    expect(getRemainingCount(state)).toBe(4);
    expect(isSessionFinished(state)).toBe(false);
  });

  test('a queue that was never started is not built', () => {
    expect(createSessionQueueState<Item>().isBuilt).toBe(false);
  });

  test('a session with no cards is finished as soon as it is built', () => {
    const state = start({ reviewCards: [], newCards: [] });
    expect(state.isBuilt).toBe(true);
    expect(isSessionFinished(state)).toBe(true);
    expect(getCurrentSessionCard(state)).toBeUndefined();
    expect(getRemainingCount(state)).toBe(0);
  });

  test('starting again replaces the old session, its retries and its stats', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Again);
    state = reduce(state, {
      type: 'start',
      cards: { reviewCards: [item('p1')], newCards: [] },
      isPracticeAhead: true,
    });

    expect(state.isPracticeAhead).toBe(true);
    expect(state.sessionQueue.map((i) => i.id)).toEqual(['p1']);
    expect(state.learningQueue).toEqual([]);
    expect(state.stats.reviewed).toBe(0);
    expect(currentId(state)).toBe('p1');
    expect(getRemainingCount(state)).toBe(1);
  });
});

describe('rating', () => {
  test('passing every card finishes the session in order', () => {
    const { shown, state } = play(twoReviewsTwoNew(), [
      Rating.Good,
      Rating.Easy,
      Rating.Hard,
      Rating.Good,
    ]);

    expect(shown).toEqual(['r1', 'r2', 'n1', 'n2']);
    expect(isSessionFinished(state)).toBe(true);
    expect(getRemainingCount(state)).toBe(0);
  });

  test('a card rated Again comes back after the rest of the session, with its new review data', () => {
    const state = rate(twoReviewsTwoNew(), Rating.Again);
    expect(getRemainingCount(state)).toBe(4);

    const { shown, state: afterRest } = play(state, [Rating.Good, Rating.Good, Rating.Good]);
    expect(shown).toEqual(['r2', 'n1', 'n2']);
    expect(getCurrentSessionCard(afterRest)).toEqual({ id: 'r1', reviewData: { attempts: 1 } });
    expect(isSessionFinished(afterRest)).toBe(false);
  });

  test('retries keep cycling until each is passed, then the session finishes', () => {
    const state = start({ reviewCards: [], newCards: [item('a'), item('b'), item('c')] });
    const { shown, state: end } = play(state, [
      Rating.Again, // a
      Rating.Good, // b
      Rating.Again, // c
      Rating.Again, // a, retry 1
      Rating.Good, // c, retry 1
      Rating.Good, // a, retry 2
    ]);

    expect(shown).toEqual(['a', 'b', 'c', 'a', 'c', 'a']);
    expect(isSessionFinished(end)).toBe(true);
  });

  test('a lone card rated Again keeps coming back until passed', () => {
    let state = start({ reviewCards: [item('only')], newCards: [] });
    for (let i = 0; i < 3; i++) {
      state = rate(state, Rating.Again);
      expect(currentId(state)).toBe('only');
      expect(isSessionFinished(state)).toBe(false);
    }
    state = rate(state, Rating.Good);
    expect(isSessionFinished(state)).toBe(true);
  });

  test('the session stats count every rating, retries included', () => {
    const { state } = play(start({ reviewCards: [item('a')], newCards: [item('b')] }), [
      Rating.Again,
      Rating.Hard,
      Rating.Again,
      Rating.Easy,
    ]);

    expect(state.stats).toEqual({ reviewed: 4, again: 2, hard: 1, good: 0, easy: 1 });
    expect(state.ratingCounter).toBe(4);
  });

  test('rating after the session has finished changes nothing', () => {
    const { state } = play(start({ reviewCards: [item('a')], newCards: [] }), [Rating.Good]);
    expect(rate(state, Rating.Good)).toBe(state);
  });
});

describe('upcoming cards', () => {
  test('during the session, lists the cards after the current one and then the retries', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Again); // r1 to retries; r2 now current

    expect(getUpcomingSessionCards(state, 5).map((i) => i.id)).toEqual(['n1', 'n2', 'r1']);
    expect(getUpcomingSessionCards(state, 2).map((i) => i.id)).toEqual(['n1', 'n2']);
  });

  test('during retries, leaves out the retry being shown', () => {
    const { state } = play(start({ reviewCards: [item('a'), item('b')], newCards: [] }), [
      Rating.Again,
      Rating.Again,
    ]);

    expect(currentId(state)).toBe('a');
    expect(getUpcomingSessionCards(state, 3).map((i) => i.id)).toEqual(['b']);
  });

  test('on the last card, nothing is upcoming', () => {
    const { state } = play(twoReviewsTwoNew(), [Rating.Good, Rating.Good, Rating.Good]);
    expect(getUpcomingSessionCards(state, 3)).toEqual([]);
  });
});

describe('reassessing the previous card', () => {
  test('changing a passed card to Again brings it back as a retry', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Good); // r1 passed
    state = reduce(state, {
      type: 'reassess',
      predicate: is('r1'),
      reviewData: { attempts: 9 },
      again: true,
    });

    expect(state.learningQueue).toEqual([{ id: 'r1', reviewData: { attempts: 9 } }]);
    expect(getRemainingCount(state)).toBe(4);
    expect(currentId(state)).toBe('r2');
  });

  test('changing a retry to Again again updates it in place rather than adding a copy', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Again);
    state = reduce(state, {
      type: 'reassess',
      predicate: is('r1'),
      reviewData: { attempts: 9 },
      again: true,
    });

    expect(state.learningQueue).toEqual([{ id: 'r1', reviewData: { attempts: 9 } }]);
  });

  test('changing a card rated Again to a pass removes its retry', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Again);
    state = reduce(state, {
      type: 'reassess',
      predicate: is('r1'),
      reviewData: { attempts: 9 },
      again: false,
    });

    expect(state.learningQueue).toEqual([]);
    expect(getRemainingCount(state)).toBe(3);
  });

  test('a retry passed on the last card and changed back to Again reopens the finished session', () => {
    let state = start({ reviewCards: [item('a')], newCards: [] });
    state = rate(state, Rating.Again); // a goes to retries
    state = rate(state, Rating.Good); // the retry is passed: session over
    expect(isSessionFinished(state)).toBe(true);

    state = reduce(state, {
      type: 'reassess',
      predicate: is('a'),
      reviewData: { attempts: 9 },
      again: true,
    });

    expect(isSessionFinished(state)).toBe(false);
    expect(getCurrentSessionCard(state)).toEqual({ id: 'a', reviewData: { attempts: 9 } });
    expect(getRemainingCount(state)).toBe(1);
  });

  test('reassessing as Again a card not yet shown leaves the queue alone', () => {
    const state = twoReviewsTwoNew();
    const next = reduce(state, {
      type: 'reassess',
      predicate: is('n2'),
      reviewData: { attempts: 9 },
      again: true,
    });
    expect(next.learningQueue).toEqual([]);
  });
});

describe('editing and deleting cards mid-session', () => {
  test('an edit reaches the card in the session and in the retries', () => {
    let state = twoReviewsTwoNew();
    state = rate(state, Rating.Again);
    state = reduce(state, {
      type: 'update',
      updater: (i) => (i.id === 'r1' || i.id === 'n2' ? { ...i, label: 'edited' } : i),
    });

    expect(state.learningQueue[0]).toMatchObject({ id: 'r1', label: 'edited' });
    expect(state.sessionQueue.find(is('n2'))?.label).toBe('edited');
    expect(state.sessionQueue.find(is('n1'))?.label).toBeUndefined();
  });

  test('deleting a card already shown keeps the current card in place', () => {
    let state = twoReviewsTwoNew();
    state = rate(rate(state, Rating.Good), Rating.Good); // n1 is current
    state = reduce(state, { type: 'remove', predicate: is('r1') });

    expect(currentId(state)).toBe('n1');
    expect(getRemainingCount(state)).toBe(2);
  });

  test('deleting the current card moves on to the next one', () => {
    let state = rate(twoReviewsTwoNew(), Rating.Good); // r2 is current
    state = reduce(state, { type: 'remove', predicate: is('r2') });

    expect(currentId(state)).toBe('n1');
    expect(getRemainingCount(state)).toBe(2);
  });

  test('deleting a card waiting for a retry removes the retry too', () => {
    let state = rate(twoReviewsTwoNew(), Rating.Again);
    state = reduce(state, { type: 'remove', predicate: is('r1') });

    expect(state.learningQueue).toEqual([]);
    expect(currentId(state)).toBe('r2');
    expect(getRemainingCount(state)).toBe(3);
  });

  test('deleting the last remaining card finishes the session', () => {
    let state = play(twoReviewsTwoNew(), [Rating.Good, Rating.Good, Rating.Good]).state;
    state = reduce(state, { type: 'remove', predicate: is('n2') });
    expect(isSessionFinished(state)).toBe(true);
  });
});

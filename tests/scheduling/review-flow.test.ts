/**
 * A learner's day end to end, composed from the same public functions the
 * review screens use: the scheduler builds the session, the queue orders it,
 * rateCard applies FSRS and recordCardReview updates the store. `Learner.rate`
 * mirrors useReviewSession's rate; going back to change a rating is driven
 * through the real hook at the end of the file.
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { Rating, State, type Grade } from 'ts-fsrs';
import { useReviewSession } from '../../src/hooks/useReviewSession';
import { recordCardReview } from '../../src/lib/reviewSession/recordReview';
import getVocabularySessionCards from '../../src/lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyPracticeAheadCards from '../../src/lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getVocabularyExtraNewCards from '../../src/lib/vocabularyScheduler/getVocabularyExtraNewCards';
import type { VocabularySessionCard } from '../../src/lib/vocabularyScheduler/types';
import {
  createSessionQueueState,
  getCurrentSessionCard,
  isSessionFinished,
  sessionQueueReducer,
  type SessionCards,
  type SessionQueueState,
} from '../../src/lib/reviewSession/sessionQueue';
import rateCard from '../../src/lib/fsrsUtils/rateCard';
import { getDefaultVocabularyReviewStore } from '../../src/lib/storage/helpers';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import { DAY, freezeTime, graduated, NOW, recordWordReview } from './fixtures';
import { stubs } from '../helpers/stub';

beforeEach(() => freezeTime());

const settings = { newCardsPerDay: 2 };

/** Five built-in words: 1 is due for review, 2-5 have never been seen. */
const words = stubs<VocabularyWord>([1, 2, 3, 4, 5].map((id) => ({ id })));

function freshStore(): VocabularyReviewDataStore {
  return {
    ...getDefaultVocabularyReviewStore(),
    cards: { 1: { wordId: 1, fsrsCard: graduated(-1) } },
  };
}

class Learner {
  queue: SessionQueueState<VocabularySessionCard> = createSessionQueueState();
  store: VocabularyReviewDataStore;

  constructor(store: VocabularyReviewDataStore) {
    this.store = store;
  }

  start(cards: SessionCards<VocabularySessionCard>, isPracticeAhead = false) {
    this.queue = sessionQueueReducer(this.queue, { type: 'start', cards, isPracticeAhead });
  }

  startSession() {
    this.start(getVocabularySessionCards(words, this.store, settings));
  }

  get current() {
    return getCurrentSessionCard(this.queue);
  }

  get finished() {
    return isSessionFinished(this.queue);
  }

  /** What the review screen does when the learner taps a rating. */
  rate(rating: Grade) {
    const current = this.current!;
    const reviewData = rateCard(current.reviewData, rating);
    this.queue = sessionQueueReducer(this.queue, { type: 'rate', reviewData, rating });
    this.store = recordWordReview(this.store, current.word.id, reviewData, {
      isNew: current.isNew,
      completed: rating !== Rating.Again,
    });
    return current.word.id;
  }

  /** Rates until the session ends, using `ratings` in turn and Good once they run out. */
  finish(ratings: Grade[] = []) {
    const shown: VocabularyWord['id'][] = [];
    while (!this.finished) shown.push(this.rate(ratings.shift() ?? Rating.Good));
    return shown;
  }
}

const ids = (cards: VocabularySessionCard[]) => cards.map((c) => c.word.id);

test('a session resumed after a reload picks up where the learner left off', () => {
  const learner = new Learner(freshStore());
  learner.startSession();
  expect(ids(learner.queue.sessionQueue)).toEqual([1, 2, 3]);

  learner.rate(Rating.Good); // word 1, the due review
  learner.rate(Rating.Again); // word 2, new: still to be learned today

  // The app reloads and rebuilds the session from the saved store.
  const resumed = getVocabularySessionCards(words, learner.store, settings);

  expect(ids(resumed.reviewCards)).toEqual([2]);
  expect(ids(resumed.newCards)).toEqual([3]);
});

test('after a finished session nothing more is offered today, retries included', () => {
  const learner = new Learner(freshStore());
  learner.startSession();

  const shown = learner.finish([Rating.Good, Rating.Again, Rating.Good, Rating.Again]);

  expect(shown).toEqual([1, 2, 3, 2, 2]);
  expect(learner.store.newCardsToday).toEqual([2, 3]);
  expect(learner.store.reviewedToday.slice().sort()).toEqual([1, 2, 3]);
  expect(getVocabularySessionCards(words, learner.store, settings)).toEqual({
    reviewCards: [],
    newCards: [],
  });
});

test('the next day brings back unfinished learning cards and a fresh new-card allowance', () => {
  const learner = new Learner(freshStore());
  learner.startSession();
  learner.finish();

  // A new local day: the loader replaces the counters but keeps the cards.
  freezeTime(new Date(NOW.getTime() + DAY));
  const tomorrow = { ...getDefaultVocabularyReviewStore(), cards: learner.store.cards };
  const session = getVocabularySessionCards(words, tomorrow, settings);

  // Words 2 and 3 were passed once and sit on a learning step.
  expect(ids(session.reviewCards).sort()).toEqual([2, 3]);
  expect(ids(session.newCards)).toEqual([4, 5]);
});

test('extra new cards after the allowance is used up are recorded as introduced', () => {
  const learner = new Learner(freshStore());
  learner.startSession();
  learner.finish();

  learner.start({ reviewCards: [], newCards: getVocabularyExtraNewCards(words, learner.store, 5) });
  expect(learner.finish()).toEqual([4, 5]);

  expect(learner.store.newCardsToday).toEqual([2, 3, 4, 5]);
  expect(getVocabularyExtraNewCards(words, learner.store, 5)).toEqual([]);
});

test('each round of review early moves on to words not yet reviewed today', () => {
  const learner = new Learner({
    ...getDefaultVocabularyReviewStore(),
    cards: Object.fromEntries(
      [1, 2, 3, 4].map((id) => [id, { wordId: id, fsrsCard: graduated(id) }])
    ),
  });

  learner.start(
    { reviewCards: getVocabularyPracticeAheadCards(words, learner.store, 2), newCards: [] },
    true
  );
  expect(learner.finish()).toEqual([1, 2]);

  learner.start(
    { reviewCards: getVocabularyPracticeAheadCards(words, learner.store, 2), newCards: [] },
    true
  );
  expect(learner.finish()).toEqual([3, 4]);

  expect(getVocabularyPracticeAheadCards(words, learner.store, 2)).toEqual([]);
});

test('a review card failed in the session stays due today until it is passed', () => {
  const learner = new Learner(freshStore());
  learner.startSession();
  learner.rate(Rating.Again); // word 1 lapses

  const rebuilt = getVocabularySessionCards(words, learner.store, settings);
  expect(ids(rebuilt.reviewCards)).toEqual([1]);
  expect(learner.store.cards[1].fsrsCard.lapses).toBe(1);
});

/**
 * The vocabulary review screen's session: the real useReviewSession hook, wired to the
 * same schedulers and recordCardReview, with a parent that commits each saved store.
 */
function renderVocabularyReview(initial: VocabularyReviewDataStore) {
  const { result } = renderHook(() => {
    const [store, setStore] = useState(initial);
    const session = useReviewSession({
      cardKey: 'word',
      getId: (word: VocabularyWord) => word.id,
      getAudioUrls: () => [],
      ready: true,
      getSessionCards: () => getVocabularySessionCards(words, store, settings),
      getPracticeAheadCards: (count, current) =>
        getVocabularyPracticeAheadCards(words, current, count),
      getExtraNewCards: (count, current) => getVocabularyExtraNewCards(words, current, count),
      reviewStore: store,
      recordReview: recordCardReview,
      saveReviewStore: async (next) => setStore(next),
    });
    return { session, store };
  });
  return {
    session: () => result.current.session,
    store: () => result.current.store,
    currentId: () => result.current.session.currentCard?.word.id,
    /** Lets a (re)build run; the hook starts the session in a microtask. */
    settle: () => act(async () => {}),
  };
}

/** Rates word 1 (the due review) Good, then goes back and changes it to Again. */
async function passThenChangeToAgain() {
  const screen = renderVocabularyReview(freshStore());
  await screen.settle();
  expect(screen.currentId()).toBe(1);
  act(() => screen.session().rate(Rating.Good));
  act(() => screen.session().history.goBack());
  act(() => screen.session().reassess(Rating.Again));
  return screen;
}

test('a passed card changed to Again is saved as relearning and retried in the live session', async () => {
  const screen = await passThenChangeToAgain();
  // Words 2 and 3, plus word 1 waiting as a retry.
  expect(screen.session().totalRemaining).toBe(3);

  // Flush the buffered save by rebuilding, then look at what was stored.
  act(() => screen.session().rebuildSession());
  await screen.settle();
  expect(screen.store().cards[1].fsrsCard.state).toBe(State.Relearning);
  expect(screen.store().cards[1].fsrsCard.lapses).toBe(1);
});

test('a passed card changed to Again is still in the session after it is rebuilt', async () => {
  const screen = await passThenChangeToAgain();

  act(() => screen.session().rebuildSession());
  await screen.settle();

  expect(screen.currentId()).toBe(1);
});

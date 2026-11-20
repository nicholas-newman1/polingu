import { Rating, type Grade } from 'ts-fsrs';

export interface SessionCards<S> {
  reviewCards: S[];
  newCards: S[];
}

export interface SessionReviewStats {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface SessionQueueState<S> {
  sessionQueue: S[];
  learningQueue: S[];
  currentIndex: number;
  reviewCount: number;
  newCount: number;
  isPracticeAhead: boolean;
  ratingCounter: number;
  isBuilt: boolean;
  stats: SessionReviewStats;
}

export type SessionQueueAction<S extends { reviewData: unknown }> =
  | { type: 'start'; cards: SessionCards<S>; isPracticeAhead: boolean }
  | { type: 'rate'; reviewData: S['reviewData']; rating: Grade }
  | {
      type: 'reassess';
      predicate: (item: S) => boolean;
      reviewData: S['reviewData'];
      again: boolean;
    }
  | { type: 'update'; updater: (item: S) => S }
  | { type: 'remove'; predicate: (item: S) => boolean };

function createEmptyStats(): SessionReviewStats {
  return { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

function recordRatingStat(stats: SessionReviewStats, rating: Grade): SessionReviewStats {
  return {
    reviewed: stats.reviewed + 1,
    again: stats.again + (rating === Rating.Again ? 1 : 0),
    hard: stats.hard + (rating === Rating.Hard ? 1 : 0),
    good: stats.good + (rating === Rating.Good ? 1 : 0),
    easy: stats.easy + (rating === Rating.Easy ? 1 : 0),
  };
}

export function createSessionQueueState<S>(): SessionQueueState<S> {
  return {
    sessionQueue: [],
    learningQueue: [],
    currentIndex: 0,
    reviewCount: 0,
    newCount: 0,
    isPracticeAhead: false,
    ratingCounter: 0,
    isBuilt: false,
    stats: createEmptyStats(),
  };
}

function reassessLearningQueue<S extends { reviewData: unknown }>(
  state: SessionQueueState<S>,
  { predicate, reviewData, again }: Extract<SessionQueueAction<S>, { type: 'reassess' }>
): S[] {
  if (!again) return state.learningQueue.filter((item) => !predicate(item));

  // Keep an existing retry in place, or restore a previously completed card.
  if (state.learningQueue.some(predicate)) {
    return state.learningQueue.map((item) => (predicate(item) ? { ...item, reviewData } : item));
  }
  const card = state.sessionQueue.slice(0, state.currentIndex).find(predicate);
  return card ? [...state.learningQueue, { ...card, reviewData }] : state.learningQueue;
}

export function sessionQueueReducer<S extends { reviewData: unknown }>(
  state: SessionQueueState<S>,
  action: SessionQueueAction<S>
): SessionQueueState<S> {
  switch (action.type) {
    case 'start': {
      const { reviewCards, newCards } = action.cards;
      return {
        ...state,
        sessionQueue: [...reviewCards, ...newCards],
        learningQueue: [],
        currentIndex: 0,
        reviewCount: reviewCards.length,
        newCount: newCards.length,
        isPracticeAhead: action.isPracticeAhead,
        isBuilt: true,
        stats: createEmptyStats(),
      };
    }

    case 'rate': {
      const { reviewData, rating } = action;
      const again = rating === Rating.Again;
      const ratingCounter = state.ratingCounter + 1;
      const stats = recordRatingStat(state.stats, rating);

      if (state.currentIndex < state.sessionQueue.length) {
        const current = state.sessionQueue[state.currentIndex];
        return {
          ...state,
          currentIndex: state.currentIndex + 1,
          learningQueue: again
            ? [...state.learningQueue, { ...current, reviewData }]
            : state.learningQueue,
          ratingCounter,
          stats,
        };
      }

      const [current, ...rest] = state.learningQueue;
      if (!current) return state;
      return {
        ...state,
        learningQueue: again ? [...rest, { ...current, reviewData }] : rest,
        ratingCounter,
        stats,
      };
    }

    case 'reassess':
      return { ...state, learningQueue: reassessLearningQueue(state, action) };

    case 'update':
      return {
        ...state,
        sessionQueue: state.sessionQueue.map(action.updater),
        learningQueue: state.learningQueue.map(action.updater),
      };

    case 'remove': {
      const keep = (item: S) => !action.predicate(item);
      const removedBeforeCurrent = state.sessionQueue
        .slice(0, state.currentIndex)
        .filter(action.predicate).length;
      return {
        ...state,
        sessionQueue: state.sessionQueue.filter(keep),
        learningQueue: state.learningQueue.filter(keep),
        currentIndex: state.currentIndex - removedBeforeCurrent,
      };
    }
  }
}

export function getCurrentSessionCard<S>(state: SessionQueueState<S>): S | undefined {
  return state.sessionQueue[state.currentIndex] ?? state.learningQueue[0];
}

export function isSessionFinished<S>(state: SessionQueueState<S>): boolean {
  return state.currentIndex >= state.sessionQueue.length && state.learningQueue.length === 0;
}

export function getRemainingCount<S>(state: SessionQueueState<S>): number {
  return state.sessionQueue.length - state.currentIndex + state.learningQueue.length;
}

export function getUpcomingSessionCards<S>(state: SessionQueueState<S>, count: number): S[] {
  const { sessionQueue, learningQueue, currentIndex } = state;
  const inSessionPhase = currentIndex < sessionQueue.length;
  return [
    ...sessionQueue.slice(currentIndex + 1, currentIndex + 1 + count),
    ...learningQueue.slice(inSessionPhase ? 0 : 1),
  ].slice(0, count);
}

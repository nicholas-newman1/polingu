export interface SessionCards<S> {
  reviewCards: S[];
  newCards: S[];
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
}

export type SessionQueueAction<S extends { reviewData: unknown }> =
  | { type: 'start'; cards: SessionCards<S>; isPracticeAhead: boolean }
  | { type: 'rate'; reviewData: S['reviewData']; again: boolean }
  | { type: 'update'; updater: (item: S) => S }
  | { type: 'remove'; predicate: (item: S) => boolean };

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
  };
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
      };
    }

    case 'rate': {
      const { reviewData, again } = action;
      const ratingCounter = state.ratingCounter + 1;

      if (state.currentIndex < state.sessionQueue.length) {
        const current = state.sessionQueue[state.currentIndex];
        return {
          ...state,
          currentIndex: state.currentIndex + 1,
          learningQueue: again
            ? [...state.learningQueue, { ...current, reviewData }]
            : state.learningQueue,
          ratingCounter,
        };
      }

      const [current, ...rest] = state.learningQueue;
      if (!current) return state;
      return {
        ...state,
        learningQueue: again ? [...rest, { ...current, reviewData }] : rest,
        ratingCounter,
      };
    }

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

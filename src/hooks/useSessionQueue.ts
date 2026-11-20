import { useCallback, useReducer } from 'react';
import type { Grade } from 'ts-fsrs';
import {
  createSessionQueueState,
  getCurrentSessionCard,
  getRemainingCount,
  getUpcomingSessionCards,
  isSessionFinished,
  sessionQueueReducer,
  type SessionCards,
  type SessionQueueState,
} from '../lib/reviewSession/sessionQueue';

export interface SessionQueue<S extends { reviewData: unknown }> extends SessionQueueState<S> {
  currentCard: S | undefined;
  isFinished: boolean;
  totalRemaining: number;
  sessionTotal: number;
  start: (cards: SessionCards<S>, options?: { isPracticeAhead?: boolean }) => void;
  rate: (reviewData: S['reviewData'], rating: Grade) => void;
  reassess: (predicate: (item: S) => boolean, reviewData: S['reviewData'], again: boolean) => void;
  update: (updater: (item: S) => S) => void;
  remove: (predicate: (item: S) => boolean) => void;
  upcoming: (count: number) => S[];
}

export function useSessionQueue<S extends { reviewData: unknown }>(): SessionQueue<S> {
  const [state, dispatch] = useReducer(
    sessionQueueReducer<S>,
    undefined,
    createSessionQueueState<S>
  );

  const start = useCallback(
    (cards: SessionCards<S>, options?: { isPracticeAhead?: boolean }) =>
      dispatch({ type: 'start', cards, isPracticeAhead: options?.isPracticeAhead ?? false }),
    []
  );
  const rate = useCallback(
    (reviewData: S['reviewData'], rating: Grade) => dispatch({ type: 'rate', reviewData, rating }),
    []
  );
  const update = useCallback(
    (updater: (item: S) => S) => dispatch({ type: 'update', updater }),
    []
  );
  const reassess = useCallback(
    (predicate: (item: S) => boolean, reviewData: S['reviewData'], again: boolean) =>
      dispatch({ type: 'reassess', predicate, reviewData, again }),
    []
  );
  const remove = useCallback(
    (predicate: (item: S) => boolean) => dispatch({ type: 'remove', predicate }),
    []
  );

  return {
    ...state,
    currentCard: getCurrentSessionCard(state),
    isFinished: isSessionFinished(state),
    totalRemaining: getRemainingCount(state),
    sessionTotal: state.sessionQueue.length,
    start,
    rate,
    reassess,
    update,
    remove,
    upcoming: (count) => getUpcomingSessionCards(state, count),
  };
}

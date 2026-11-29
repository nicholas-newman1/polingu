import { useCallback, useReducer } from 'react';
import type { Grade } from 'ts-fsrs';
import {
  createSessionQueueState,
  getCurrentSessionCard,
  getRemainingCount,
  getRemainingCountsByKind,
  getUpcomingSessionCards,
  isSessionFinished,
  sessionQueueReducer,
  type SessionCards,
  type SessionQueueState,
} from '../lib/reviewSession/sessionQueue';

interface SessionQueueItem {
  reviewData: unknown;
  isNew: boolean;
}

export interface SessionQueue<S extends SessionQueueItem> extends SessionQueueState<S> {
  currentCard: S | undefined;
  isFinished: boolean;
  totalRemaining: number;
  reviewCount: number;
  newCount: number;
  sessionTotal: number;
  start: (cards: SessionCards<S>, options?: { isPracticeAhead?: boolean }) => void;
  rate: (reviewData: S['reviewData'], rating: Grade) => void;
  reassess: (predicate: (item: S) => boolean, reviewData: S['reviewData'], again: boolean) => void;
  update: (updater: (item: S) => S) => void;
  remove: (predicate: (item: S) => boolean) => void;
  upcoming: (count: number) => S[];
}

export function useSessionQueue<S extends SessionQueueItem>(): SessionQueue<S> {
  const [state, dispatch] = useReducer(
    sessionQueueReducer<S>,
    undefined,
    createSessionQueueState<S>
  );

  // Stable, so the session's build effect does not run again on every render.
  const start = useCallback(
    (cards: SessionCards<S>, options?: { isPracticeAhead?: boolean }) =>
      dispatch({ type: 'start', cards, isPracticeAhead: options?.isPracticeAhead ?? false }),
    []
  );
  const rate = (reviewData: S['reviewData'], rating: Grade) =>
    dispatch({ type: 'rate', reviewData, rating });
  const update = (updater: (item: S) => S) => dispatch({ type: 'update', updater });
  const reassess = (predicate: (item: S) => boolean, reviewData: S['reviewData'], again: boolean) =>
    dispatch({ type: 'reassess', predicate, reviewData, again });
  const remove = (predicate: (item: S) => boolean) => dispatch({ type: 'remove', predicate });

  return {
    ...state,
    currentCard: getCurrentSessionCard(state),
    isFinished: isSessionFinished(state),
    totalRemaining: getRemainingCount(state),
    ...getRemainingCountsByKind(state),
    sessionTotal: state.sessionQueue.length,
    start,
    rate,
    reassess,
    update,
    remove,
    upcoming: (count) => getUpcomingSessionCards(state, count),
  };
}

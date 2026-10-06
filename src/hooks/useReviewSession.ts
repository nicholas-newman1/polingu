import { useCallback, useEffect, useRef, useState } from 'react';
import { Rating, type Card as FSRSCard, type Grade } from 'ts-fsrs';
import rateCard from '../lib/fsrsUtils/rateCard';
import type { SessionCards } from '../lib/reviewSession/sessionQueue';
import type { ReviewOutcome } from '../lib/reviewSession/recordReview';
import type { RatingIntervals } from '../components/RatingButtons';
import { useCardHistory } from './useCardHistory';
import { usePracticeDeck } from './usePracticeDeck';
import { usePrefetchAudio } from './usePrefetchAudio';
import { useRatingIntervals } from './useRatingIntervals';
import { useSessionQueue } from './useSessionQueue';

const UPCOMING_PREFETCH_COUNT = 3;

const EMPTY_INTERVALS: RatingIntervals = {
  [Rating.Again]: '',
  [Rating.Hard]: '',
  [Rating.Good]: '',
  [Rating.Easy]: '',
};

interface ReviewableSessionCard {
  reviewData: { fsrsCard: FSRSCard };
  isNew: boolean;
}

export interface UseReviewSessionOptions<
  S extends ReviewableSessionCard,
  K extends keyof S & string,
  Id,
  Store,
> {
  /** Property of the session card holding the card itself (e.g. `'word'`). */
  cardKey: K;
  getId: (card: S[K]) => Id;
  getAudioUrls: (card: S[K]) => Array<string | null | undefined>;

  /** The session is built once this is true, and rebuilt whenever `sessionKey` changes. */
  ready: boolean;
  sessionKey?: string;
  getSessionCards: () => SessionCards<S>;
  getPracticeAheadCards: (count: number) => S[];
  getExtraNewCards: (count: number) => S[];

  reviewStore: Store;
  recordReview: (
    store: Store,
    id: Id,
    reviewData: S['reviewData'],
    outcome: ReviewOutcome
  ) => Store;
  saveReviewStore: (store: Store) => Promise<void>;
}

export function useReviewSession<
  S extends ReviewableSessionCard,
  K extends keyof S & string,
  Id,
  Store,
>(options: UseReviewSessionOptions<S, K, Id, Store>) {
  const {
    cardKey,
    getId,
    getAudioUrls,
    ready,
    sessionKey = '',
    reviewStore,
    recordReview,
    saveReviewStore,
  } = options;

  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
  });

  const queue = useSessionQueue<S>();
  const practice = usePracticeDeck<S[K]>();
  const history = useCardHistory<S[K], S['reviewData']>();
  const { start } = queue;
  const { clearHistory, addToHistory, updateInHistory, goForward, historyCard, historyMeta } =
    history;

  const [practiceAheadCount, setPracticeAheadCount] = useState(10);
  const [extraNewCardsCount, setExtraNewCardsCount] = useState(5);

  const startSession = useCallback(
    (cards: SessionCards<S>) => {
      start(cards);
      clearHistory();
    },
    [start, clearHistory]
  );

  const [rebuildRequest, setRebuildRequest] = useState(0);
  const builtForRef = useRef<string | null>(null);
  useEffect(() => {
    const buildKey = `${sessionKey}:${rebuildRequest}`;
    if (!ready || builtForRef.current === buildKey) return;
    builtForRef.current = buildKey;
    queueMicrotask(() => startSession(latestOptions.current.getSessionCards()));
  }, [ready, sessionKey, rebuildRequest, startSession]);

  /** Rebuilds from `getSessionCards` after the next render, so it sees freshly saved data. */
  const rebuildSession = useCallback(() => setRebuildRequest((n) => n + 1), []);

  const startPracticeAhead = () =>
    start(
      { reviewCards: options.getPracticeAheadCards(practiceAheadCount), newCards: [] },
      { isPracticeAhead: true }
    );

  const startExtraNewCards = () =>
    start({ reviewCards: [], newCards: options.getExtraNewCards(extraNewCardsCount) });

  const { currentCard } = queue;

  const rate = async (rating: Grade) => {
    if (!currentCard) return;
    const card = currentCard[cardKey];
    addToHistory(card, currentCard.reviewData);

    const reviewData = rateCard(currentCard.reviewData, rating);
    const again = rating === Rating.Again;
    queue.rate(reviewData, again);

    await saveReviewStore(
      recordReview(reviewStore, getId(card), reviewData, {
        isNew: currentCard.isNew,
        completed: !again,
      })
    );
  };

  const reassess = async (rating: Grade) => {
    if (!historyCard || !historyMeta) return;
    const reviewData = rateCard(historyMeta, rating);
    await saveReviewStore(
      recordReview(reviewStore, getId(historyCard), reviewData, { isNew: false, completed: false })
    );
    goForward();
  };

  /** Applies an edit to the card wherever it appears: session, practice deck and history. */
  const updateCards = (predicate: (card: S[K]) => boolean, updater: (card: S[K]) => S[K]) => {
    queue.update((item) =>
      predicate(item[cardKey]) ? ({ ...item, [cardKey]: updater(item[cardKey]) } as S) : item
    );
    practice.update(predicate, updater);
    updateInHistory(predicate, updater);
  };

  const removeCards = (predicate: (card: S[K]) => boolean) => {
    queue.remove((item) => predicate(item[cardKey]));
    practice.remove(predicate);
  };

  const intervals = useRatingIntervals(currentCard?.reviewData.fsrsCard) ?? EMPTY_INTERVALS;
  const reassessIntervals = useRatingIntervals(historyMeta?.fsrsCard);

  const upcomingCards = practice.active
    ? practice.upcoming(UPCOMING_PREFETCH_COUNT)
    : queue.upcoming(UPCOMING_PREFETCH_COUNT).map((item) => item[cardKey]);
  usePrefetchAudio(upcomingCards.flatMap(getAudioUrls));

  return {
    currentCard,
    isFinished: queue.isFinished,
    isBuilt: queue.isBuilt,
    totalRemaining: queue.totalRemaining,
    reviewCount: queue.reviewCount,
    newCount: queue.newCount,
    isPracticeAhead: queue.isPracticeAhead,
    ratingCounter: queue.ratingCounter,
    startSession,
    rebuildSession,
    rate,
    reassess,
    intervals,
    reassessIntervals,
    updateCards,
    removeCards,
    practice,
    history,
    finishedStateProps: {
      practiceAheadCount,
      setPracticeAheadCount,
      extraNewCardsCount,
      setExtraNewCardsCount,
      onPracticeAhead: startPracticeAhead,
      onLearnExtra: startExtraNewCards,
    },
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import rateCard from '../lib/fsrsUtils/rateCard';
import type { SessionCards } from '../lib/reviewSession/sessionQueue';
import { recordCardReview } from '../lib/reviewSession/recordReview';
import {
  getExtraNewCards,
  getPracticeAheadCards,
  getSessionCards,
  itemsMatching,
  type ReviewDeck,
} from '../lib/reviewSession/scheduler';
import type { CardReviewData, ReviewDataStore, SessionId } from '../types/common';
import type { RatingIntervals } from '../components/RatingButtons';
import { useCardHistory } from './useCardHistory';
import { usePracticeDeck } from './usePracticeDeck';
import { usePrefetchAudio } from './usePrefetchAudio';
import { useRatingIntervals } from './useRatingIntervals';
import { useSessionQueue } from './useSessionQueue';

const UPCOMING_PREFETCH_COUNT = 3;
const SAVE_DEFER_MS = 460;

const EMPTY_INTERVALS: RatingIntervals = {
  [Rating.Again]: '',
  [Rating.Hard]: '',
  [Rating.Good]: '',
  [Rating.Easy]: '',
};

/**
 * Buffers review-store writes briefly so context-wide stats recalculations
 * and persistence run after the card exit animation settles, while coalescing
 * rapid consecutive ratings and flushing on unmount, direction switch, or pagehide.
 *
 * Buffered ratings are kept as changes, not as a finished store: if the parent
 * hands in a new store while they wait (a background sync from another device),
 * they are re-applied on top of it rather than saved over it.
 */
function useDeferredReviewSave<Store>(
  reviewStore: Store,
  saveReviewStore: (store: Store) => Promise<void>,
  sessionKey: string
) {
  const latestStoreRef = useRef(reviewStore);
  const lastFlushedRef = useRef<Store | null>(null);
  const pendingRef = useRef<Array<(base: Store) => Store>>([]);
  const timerRef = useRef<number | null>(null);
  const saveFnRef = useRef(saveReviewStore);

  /** Saves any buffered ratings now and returns the store including them. */
  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current.length === 0) return latestStoreRef.current;
    pendingRef.current = [];
    const storeToSave = latestStoreRef.current;
    lastFlushedRef.current = storeToSave;
    void saveFnRef.current(storeToSave);
    return storeToSave;
  }, []);

  // Declared before syncing refs so sessionKey changes flush with the previous direction's saver.
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
      lastFlushedRef.current = null;
    };
  }, [sessionKey, flush]);

  const baseStoreRef = useRef(reviewStore);
  useEffect(() => {
    saveFnRef.current = saveReviewStore;
    if (reviewStore === baseStoreRef.current) return;
    baseStoreRef.current = reviewStore;
    // Our own save coming back needs nothing; any other store becomes the new base.
    if (reviewStore !== lastFlushedRef.current) {
      latestStoreRef.current = pendingRef.current.reduce(
        (store, apply) => apply(store),
        reviewStore
      );
    }
  }, [reviewStore, saveReviewStore]);

  const scheduleSave = useCallback(
    (apply: (base: Store) => Store) => {
      pendingRef.current = [...pendingRef.current, apply];
      latestStoreRef.current = apply(latestStoreRef.current);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(flush, SAVE_DEFER_MS);
    },
    [flush]
  );

  return { scheduleSave, flush };
}

export interface ReviewableSessionCard {
  reviewData: CardReviewData;
  isNew: boolean;
}

export interface UseReviewSessionOptions<
  S extends ReviewableSessionCard,
  K extends keyof S,
  Id extends SessionId,
  Filters,
> {
  deck: ReviewDeck<S[K], S['reviewData'], Id, S, Filters, K>;
  /** The deck's items, which the session, its extra rounds and the practice deck draw on. */
  items: readonly S[K][];
  store: ReviewDataStore<S['reviewData'], Id>;
  settings: { newCardsPerDay: number };
  /** The learner's filters, for a deck that has them. */
  filters?: Filters;
  save: (store: ReviewDataStore<S['reviewData'], Id>) => Promise<void>;
  getAudioUrls: (item: S[K]) => Array<string | null | undefined>;
  /** The session is built once this is true, and rebuilt whenever `sessionKey` changes. */
  ready: boolean;
  sessionKey?: string;
}

export function useReviewSession<
  S extends ReviewableSessionCard,
  K extends keyof S,
  Id extends SessionId,
  Filters,
>(options: UseReviewSessionOptions<S, K, Id, Filters>) {
  type Item = S[K];
  const {
    deck,
    items,
    store: reviewStore,
    settings,
    filters,
    save,
    getAudioUrls,
    ready,
    sessionKey = '',
  } = options;
  const itemOf = (card: S): Item => card[deck.cardKey];

  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
  });

  const queue = useSessionQueue<S>();
  const practice = usePracticeDeck<Item>();
  const history = useCardHistory<Item, S['reviewData']>();
  const { scheduleSave, flush: flushPendingSave } = useDeferredReviewSave(
    reviewStore,
    save,
    sessionKey
  );
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
    queueMicrotask(() => {
      const latest = latestOptions.current;
      startSession(
        getSessionCards(latest.deck, latest.items, latest.store, latest.settings, latest.filters)
      );
    });
  }, [ready, sessionKey, rebuildRequest, startSession]);

  /**
   * Starts the session over now, saving buffered ratings first so it leaves those cards
   * out. Pass filters the caller has just changed, which this render's options lack.
   */
  const restart = (nextFilters = filters) =>
    startSession(getSessionCards(deck, items, flushPendingSave(), settings, nextFilters));

  /** Starts the session over after the next render, so it sees data the caller has just changed. */
  const restartAfterRender = () => {
    flushPendingSave();
    setRebuildRequest((n) => n + 1);
  };

  const startPracticeAhead = () => {
    const store = flushPendingSave();
    start(
      {
        reviewCards: getPracticeAheadCards(deck, items, store, practiceAheadCount, filters),
        newCards: [],
      },
      { isPracticeAhead: true }
    );
  };

  const startExtraNewCards = () => {
    const store = flushPendingSave();
    start({
      reviewCards: [],
      newCards: getExtraNewCards(deck, items, store, extraNewCardsCount, filters),
    });
  };

  const { currentCard } = queue;

  const rate = (rating: Grade) => {
    if (!currentCard) return;
    const card = itemOf(currentCard);
    const cardId = deck.idOf(card);
    const isNew = currentCard.isNew;
    addToHistory(card, currentCard.reviewData);

    const reviewData = rateCard(currentCard.reviewData, rating);
    const again = rating === Rating.Again;
    queue.rate(reviewData, rating);

    scheduleSave((baseStore) =>
      recordCardReview(baseStore, cardId, reviewData, {
        isNew,
        completed: !again,
      })
    );
  };

  const reassess = (rating: Grade) => {
    if (!historyCard || !historyMeta) return;
    const reviewData = rateCard(historyMeta, rating);
    const id = deck.idOf(historyCard);
    const again = rating === Rating.Again;
    queue.reassess((item) => deck.idOf(itemOf(item)) === id, reviewData, again);
    goForward();
    // The queue now holds the card for a retry (Again) or has let it go, so
    // today's reviewed list has to say the same.
    scheduleSave((baseStore) =>
      recordCardReview(baseStore, id, reviewData, {
        isNew: false,
        completed: !again,
        requeued: again,
      })
    );
  };

  /** Applies an edit to the card wherever it appears: session, practice deck and history. */
  const updateCards = (predicate: (card: Item) => boolean, updater: (card: Item) => Item) => {
    queue.update((item) =>
      predicate(itemOf(item)) ? ({ ...item, [deck.cardKey]: updater(itemOf(item)) } as S) : item
    );
    practice.update(predicate, updater);
    updateInHistory(predicate, updater);
  };

  const removeCards = (predicate: (card: Item) => boolean) => {
    queue.remove((item) => predicate(itemOf(item)));
    practice.remove(predicate);
  };

  const intervals = useRatingIntervals(currentCard?.reviewData.fsrsCard) ?? EMPTY_INTERVALS;
  const reassessIntervals = useRatingIntervals(historyMeta?.fsrsCard);

  const upcomingCards = practice.active
    ? practice.upcoming(UPCOMING_PREFETCH_COUNT)
    : queue.upcoming(UPCOMING_PREFETCH_COUNT).map(itemOf);
  usePrefetchAudio(upcomingCards.flatMap(getAudioUrls));

  return {
    idOf: deck.idOf,
    currentCard,
    currentItem: currentCard && itemOf(currentCard),
    isFinished: queue.isFinished,
    isBuilt: queue.isBuilt,
    totalRemaining: queue.totalRemaining,
    sessionTotal: queue.sessionTotal,
    reviewCount: queue.reviewCount,
    newCount: queue.newCount,
    isPracticeAhead: queue.isPracticeAhead,
    ratingCounter: queue.ratingCounter,
    restart,
    restartAfterRender,
    rate,
    reassess,
    intervals,
    reassessIntervals,
    updateCards,
    removeCards,
    practice,
    /** Enters practice mode with the items that pass the filters, or leaves it. */
    togglePractice: () => practice.toggle(itemsMatching(deck, items, filters)),
    history,
    finishedStateProps: {
      sessionStats: queue.stats,
      practiceAheadCount,
      setPracticeAheadCount,
      extraNewCardsCount,
      setExtraNewCardsCount,
      onPracticeAhead: startPracticeAhead,
      onLearnExtra: startExtraNewCards,
    },
  };
}

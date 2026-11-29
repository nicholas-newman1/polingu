/**
 * Renders useReviewSession the way the vocabulary page wires it: the real vocabulary
 * deck, and a parent that owns one review store per direction.
 *
 * By default the parent commits a saved store synchronously, as the review
 * contexts do. Pass `deferCommits` to hold each commit until the test releases it.
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import type { Grade } from 'ts-fsrs';
import { useReviewSession } from '../../../src/hooks/useReviewSession';
import type { TranslationDirection } from '../../../src/types/common';
import type {
  VocabularyCardReviewData,
  VocabularyReviewDataStore,
  VocabularyWord,
} from '../../../src/types/vocabulary';
import { stubs } from '../../helpers/stub';
import { vocabularyDeck } from '../../../src/lib/reviewSession/reviewDecks';

export type Store = VocabularyReviewDataStore;
export type Stores = Record<TranslationDirection, Store>;

/** How long useReviewSession buffers a rating before saving it. */
export const SAVE_DELAY_MS = 460;

export const emptyStore = (overrides: Partial<Store> = {}): Store => ({
  cards: {},
  reviewedToday: [],
  newCardsToday: [],
  lastReviewDate: '2026-03-10',
  ...overrides,
});

/** Words with the given ids, each with its own audio URL. */
export const makeWords = (...ids: string[]) =>
  stubs<VocabularyWord>(
    ids.map((id) => ({ id, polish: `pl-${id}`, english: `en-${id}`, audioUrl: `audio/${id}.mp3` }))
  );

/** A store entry for `id` holding the given FSRS card. */
export const entry = (
  id: string,
  fsrsCard: VocabularyCardReviewData['fsrsCard']
): [string, VocabularyCardReviewData] => [id, { wordId: id, fsrsCard }];

interface HarnessProps {
  direction: TranslationDirection;
  ready: boolean;
}

interface Options {
  words: VocabularyWord[];
  stores?: Partial<Stores>;
  newCardsPerDay?: number;
  ready?: boolean;
  deferCommits?: boolean;
  strictMode?: boolean;
}

export function renderReviewSession({
  words,
  stores,
  newCardsPerDay = 20,
  ready = true,
  deferCommits = false,
  strictMode = false,
}: Options) {
  const saves = vi.fn<(direction: TranslationDirection, store: Store) => void>();
  const pendingCommits: Array<() => void> = [];
  const initialStores: Stores = {
    'pl-to-en': stores?.['pl-to-en'] ?? emptyStore(),
    'en-to-pl': stores?.['en-to-pl'] ?? emptyStore(),
  };

  function useHarness({ direction, ready }: HarnessProps) {
    const [all, setAll] = useState(initialStores);
    const store = all[direction];
    const commit = (dir: TranslationDirection, next: Store) =>
      setAll((prev) => ({ ...prev, [dir]: next }));

    const session = useReviewSession({
      deck: vocabularyDeck,
      items: words,
      store,
      settings: { newCardsPerDay },
      getAudioUrls: (word) => [word.audioUrl],
      ready,
      sessionKey: direction,
      save: async (next) => {
        saves(direction, next);
        if (deferCommits) pendingCommits.push(() => commit(direction, next));
        else commit(direction, next);
      },
    });
    return { session, stores: all, replaceStore: commit };
  }

  const hook = renderHook(useHarness, {
    initialProps: { direction: 'pl-to-en' as TranslationDirection, ready },
    reactStrictMode: strictMode,
  });
  const session = () => hook.result.current.session;

  return {
    ...hook,
    saves,
    session,
    store: (direction: TranslationDirection = 'pl-to-en') => hook.result.current.stores[direction],
    currentId: () => session().currentCard?.word.id,
    /** Lets the session build, which happens in a microtask after `ready`. */
    settle: () => act(async () => {}),
    rate: (rating: Grade) => act(() => session().rate(rating)),
    reassess: (rating: Grade) => act(() => session().reassess(rating)),
    goBack: () => act(() => session().history.goBack()),
    goForward: () => act(() => session().history.goForward()),
    /** Lets the buffered save run. */
    waitForSave: () => act(() => vi.advanceTimersByTime(SAVE_DELAY_MS)),
    /** Releases saves held by `deferCommits`, in order. */
    commitPendingSaves: () => act(() => pendingCommits.splice(0).forEach((commit) => commit())),
    /** Replaces a direction's store from outside, as clearing review data does. */
    replaceStore: (direction: TranslationDirection, store: Store) =>
      act(() => hook.result.current.replaceStore(direction, store)),
    switchDirection: (direction: TranslationDirection) => hook.rerender({ direction, ready: true }),
  };
}

/** The last store saved for `direction`. */
export function lastSaved(
  saves: ReturnType<typeof renderReviewSession>['saves'],
  direction: TranslationDirection = 'pl-to-en'
): Store {
  const calls = saves.mock.calls.filter(([dir]) => dir === direction);
  const last = calls.at(-1);
  if (!last) throw new Error(`No save for ${direction}`);
  return last[1];
}

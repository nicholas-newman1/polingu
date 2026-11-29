/**
 * State shared by the review providers: a deck's review stores and settings, its
 * learner-made items, and lists loaded from storage. Each provider is started from
 * what ReviewDataProvider loaded, and picks up a later load (a background sync)
 * without undoing anything changed in memory since that load began (localChanges.ts).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { CardReviewData, ReviewDataStore, SessionId } from '../../types/common';
import {
  clearDeckProgress,
  emptyReviewStore,
  mapParts,
  partsOf,
  saveDeckSettings,
  saveReviewStore,
  type DeckPart,
  type ReviewDeckStorage,
} from '../../lib/storage/reviewDeckStorage';
import { startDayInEachStore } from '../../lib/reviewSession/sessionLists';
import { useAuthContext } from '../AuthContext';
import { useSaveError } from '../../hooks/useSaveError';
import { useSyncProps } from '../../hooks/useSyncProps';
import { keepCurrentWhere, type LocalChanges } from './localChanges';
import { useToday } from './useToday';

/**
 * A deck's review progress, one store and one settings value per part: a direction
 * for vocabulary, sentences and conjugation, or `all` for declension and aspect pairs.
 */
export interface DeckProgress<K extends DeckPart, Store, Settings> {
  /** Each part's store, with today's lists started afresh if it was saved on an earlier day. */
  stores: Record<K, Store>;
  settings: Record<K, Settings>;
  updateStore: (part: K, store: Store) => Promise<void>;
  updateSettings: (part: K, settings: Settings) => Promise<void>;
  /** Resets a part's progress; a failure is shown to the learner and leaves memory as it was. */
  clear: (part: K) => Promise<void>;
}

/** A deck's review stores and settings, saved through `parts` as they change. */
export function useDeckProgress<
  K extends DeckPart,
  R extends CardReviewData,
  Id extends SessionId,
  Settings,
>(
  parts: Record<K, ReviewDeckStorage<ReviewDataStore<R, Id>, Settings>>,
  loadedStores: Partial<Record<K, ReviewDataStore<R, Id>>> | undefined,
  loadedSettings: Record<K, Settings>,
  readAt: number | undefined,
  localChanges: LocalChanges
): DeckProgress<K, ReviewDataStore<R, Id>, Settings> {
  type Store = ReviewDataStore<R, Id>;
  const keys = partsOf(parts);
  const storesFrom = (loaded: Partial<Record<K, Store>> | undefined) =>
    mapParts(keys, (key) => loaded?.[key] ?? emptyReviewStore<R, Id>());

  const [stores, setStores] = useState(() => storesFrom(loadedStores));
  const storesRef = useRef(stores);
  const [settings, setSettings] = useState(loadedSettings);

  // Compared part by part, so a caller may wrap a single store in a new object each render.
  const loadedParts: Record<string, unknown> = {};
  for (const key of keys) {
    loadedParts[`store:${key}`] = loadedStores?.[key];
    loadedParts[`settings:${key}`] = loadedSettings[key];
  }
  useSyncProps(loadedParts, () => {
    const nextStores = keepCurrentWhere(storesFrom(loadedStores), storesRef.current, (key) =>
      localChanges.changedSince(`reviewStore:${key}`, readAt)
    );
    storesRef.current = nextStores;
    setStores(nextStores);
    setSettings((current) =>
      keepCurrentWhere(loadedSettings, current, (key) =>
        localChanges.changedSince(`settings:${key}`, readAt)
      )
    );
  });

  const showSaveError = useSaveError();
  const today = useToday();
  const todaysStores = useMemo(() => startDayInEachStore(stores, today), [stores, today]);

  const replaceStore = useCallback(
    (part: K, store: Store) => {
      const next = { ...storesRef.current, [part]: store };
      storesRef.current = next;
      setStores(next);
      localChanges.note(`reviewStore:${part}`);
    },
    [localChanges]
  );

  const updateStore = useCallback(
    async (part: K, store: Store) => {
      const prev = storesRef.current[part];
      replaceStore(part, store);
      try {
        await saveReviewStore(parts[part], prev, store);
      } catch (e) {
        showSaveError(e);
      }
    },
    [parts, replaceStore, showSaveError]
  );

  const updateSettings = useCallback(
    async (part: K, next: Settings) => {
      setSettings((prev) => ({ ...prev, [part]: next }));
      localChanges.note(`settings:${part}`);
      try {
        await saveDeckSettings(parts[part], next);
      } catch (e) {
        showSaveError(e);
      }
    },
    [parts, localChanges, showSaveError]
  );

  const clear = useCallback(
    async (part: K) => {
      try {
        await clearDeckProgress(parts[part]);
      } catch (e) {
        showSaveError(e);
        return;
      }
      replaceStore(part, emptyReviewStore<R, Id>());
      if (parts[part].resetDeletesSettings) {
        // The reset deleted the settings too, so a reload would load the defaults.
        setSettings((prev) => ({ ...prev, [part]: parts[part].defaultSettings }));
        localChanges.note(`settings:${part}`);
      }
    },
    [parts, replaceStore, localChanges, showSaveError]
  );

  return useMemo(
    () => ({ stores: todaysStores, settings, updateStore, updateSettings, clear }),
    [todaysStores, settings, updateStore, updateSettings, clear]
  );
}

/**
 * The learner's own items for a deck, kept current by a live listener while signed
 * in. Setting them (from the listener or a page edit) counts as a local change, so
 * a load that read the list earlier does not undo it.
 */
export function useCustomItems<T>(
  loaded: T[],
  subscribe: (onItems: (items: T[]) => void) => () => void,
  readAt: number | undefined,
  localChanges: LocalChanges
): [T[], Dispatch<SetStateAction<T[]>>] {
  const [items, setItemsState] = useState(loaded);
  useSyncProps({ loaded }, () => {
    if (!localChanges.changedSince('customItems', readAt)) setItemsState(loaded);
  });

  const setItems = useCallback(
    (next: SetStateAction<T[]>) => {
      setItemsState(next);
      localChanges.note('customItems');
    },
    [localChanges]
  );

  const { user } = useAuthContext();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const unsubscribe = subscribe((next) => {
      // Dropped if the listener closed (sign-out or account switch) while it was being handled.
      if (active) setItems(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, subscribe, setItems]);

  return [items, setItems];
}

/** State that starts from `loaded` and takes each newly loaded value. */
export function useLoadedState<T>(loaded: T): [T, (value: T) => void] {
  const [value, setValue] = useState(loaded);
  useSyncProps({ loaded }, () => setValue(loaded));
  return [value, setValue];
}

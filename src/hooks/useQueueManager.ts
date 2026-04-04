import { useState, useCallback, useEffect, useRef } from 'react';
import { getAudioQueue, saveAudioQueue, updateQueueSavedTime } from '../lib/audio';
import type { AudioQueue } from '../types/audio';

export type QueueSection = 'user' | 'auto';

const MAX_HISTORY = 50;
const SAVE_TIME_DEBOUNCE_MS = 1000;

export interface QueueManager {
  currentTrackId: string | null;
  userQueue: string[];
  autoQueue: string[];
  hasNext: boolean;
  hasPrevious: boolean;
  previousTrackId: string | null;
  initialSavedTime: number;
  initializeQueue: (trackIds: string[], startIndex: number) => void;
  addToQueue: (trackId: string) => void;
  insertNext: (trackId: string) => void;
  removeFromQueue: (section: QueueSection, index: number) => void;
  reorderQueue: (section: QueueSection, fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  advanceQueue: () => string | null;
  rewindQueue: () => string | null;
  skipToQueueItem: (section: QueueSection, index: number) => string | null;
  persistTime: (time: number) => void;
}

interface QueueState {
  currentTrackId: string | null;
  userQueue: string[];
  autoQueue: string[];
  history: string[];
}

const EMPTY: QueueState = {
  currentTrackId: null,
  userQueue: [],
  autoQueue: [],
  history: [],
};

function persist(state: QueueState, savedTime: number) {
  saveAudioQueue({
    currentTrackId: state.currentTrackId,
    userQueue: state.userQueue,
    autoQueue: state.autoQueue,
    history: state.history,
    savedTime,
    updatedAt: Date.now(),
  }).catch(() => {});
}

export function useQueueManager(): QueueManager {
  const [state, setState] = useState<QueueState>(EMPTY);
  const ref = useRef<QueueState>(EMPTY);
  const savedTimeRef = useRef(0);
  const [initialSavedTime, setInitialSavedTime] = useState(0);
  const saveTimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((next: QueueState, resetTime = true) => {
    ref.current = next;
    setState(next);
    if (resetTime) savedTimeRef.current = 0;
    persist(next, resetTime ? 0 : savedTimeRef.current);
  }, []);

  const persistTime = useCallback((time: number) => {
    savedTimeRef.current = time;
    if (saveTimeTimerRef.current) return;
    saveTimeTimerRef.current = setTimeout(() => {
      saveTimeTimerRef.current = null;
      updateQueueSavedTime(savedTimeRef.current).catch(() => {});
    }, SAVE_TIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeTimerRef.current) clearTimeout(saveTimeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAudioQueue()
      .then((saved: AudioQueue | null) => {
        if (cancelled || !saved || !saved.userQueue) return;
        const loaded: QueueState = {
          currentTrackId: saved.currentTrackId,
          userQueue: saved.userQueue,
          autoQueue: saved.autoQueue,
          history: saved.history ?? [],
        };
        ref.current = loaded;
        savedTimeRef.current = saved.savedTime ?? 0;
        setState(loaded);
        setInitialSavedTime(saved.savedTime ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { currentTrackId, userQueue, autoQueue, history } = state;
  const hasNext = userQueue.length > 0 || autoQueue.length > 0;
  const hasPrevious = history.length > 0;
  const previousTrackId = history.length > 0 ? history[history.length - 1] : null;

  const initializeQueue = useCallback(
    (trackIds: string[], startIndex: number) => {
      set({
        currentTrackId: trackIds[startIndex],
        userQueue: [],
        autoQueue: trackIds.slice(startIndex + 1),
        history: [],
      });
    },
    [set]
  );

  const addToQueue = useCallback(
    (trackId: string) => {
      const s = ref.current;
      set({ ...s, userQueue: [...s.userQueue, trackId] }, false);
    },
    [set]
  );

  const insertNext = useCallback(
    (trackId: string) => {
      const s = ref.current;
      set({ ...s, userQueue: [trackId, ...s.userQueue] }, false);
    },
    [set]
  );

  const removeFromQueue = useCallback(
    (section: QueueSection, index: number) => {
      const s = ref.current;
      if (section === 'user') {
        set({ ...s, userQueue: s.userQueue.filter((_, i) => i !== index) }, false);
      } else {
        set({ ...s, autoQueue: s.autoQueue.filter((_, i) => i !== index) }, false);
      }
    },
    [set]
  );

  const reorderQueue = useCallback(
    (section: QueueSection, fromIndex: number, toIndex: number) => {
      const s = ref.current;
      const arr = [...(section === 'user' ? s.userQueue : s.autoQueue)];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      if (section === 'user') {
        set({ ...s, userQueue: arr }, false);
      } else {
        set({ ...s, autoQueue: arr }, false);
      }
    },
    [set]
  );

  const clearQueue = useCallback(() => {
    set(EMPTY);
  }, [set]);

  const advanceQueue = useCallback((): string | null => {
    const s = ref.current;
    const newHistory = [...s.history, ...(s.currentTrackId ? [s.currentTrackId] : [])].slice(
      -MAX_HISTORY
    );

    if (s.userQueue.length > 0) {
      const [next, ...rest] = s.userQueue;
      set({ ...s, currentTrackId: next, userQueue: rest, history: newHistory });
      return next;
    }
    if (s.autoQueue.length > 0) {
      const [next, ...rest] = s.autoQueue;
      set({ ...s, currentTrackId: next, autoQueue: rest, history: newHistory });
      return next;
    }
    return null;
  }, [set]);

  const rewindQueue = useCallback((): string | null => {
    const s = ref.current;
    if (s.history.length === 0) return null;

    const newHistory = [...s.history];
    const prev = newHistory.pop()!;
    const newUserQueue = s.currentTrackId ? [s.currentTrackId, ...s.userQueue] : s.userQueue;

    set({
      ...s,
      currentTrackId: prev,
      userQueue: newUserQueue,
      history: newHistory,
    });
    return prev;
  }, [set]);

  const skipToQueueItem = useCallback(
    (section: QueueSection, index: number): string | null => {
      const s = ref.current;
      const arr = section === 'user' ? s.userQueue : s.autoQueue;
      if (index < 0 || index >= arr.length) return null;

      const trackId = arr[index];
      const skippedFromSection = arr.slice(0, index);
      const remaining = arr.slice(index + 1);

      const newHistory = [
        ...s.history,
        ...(s.currentTrackId ? [s.currentTrackId] : []),
        ...skippedFromSection,
      ].slice(-MAX_HISTORY);

      if (section === 'user') {
        set({
          ...s,
          currentTrackId: trackId,
          userQueue: remaining,
          history: newHistory,
        });
      } else {
        const fullHistory = [
          ...s.history,
          ...(s.currentTrackId ? [s.currentTrackId] : []),
          ...s.userQueue,
          ...skippedFromSection,
        ].slice(-MAX_HISTORY);
        set({
          ...s,
          currentTrackId: trackId,
          userQueue: [],
          autoQueue: remaining,
          history: fullHistory,
        });
      }
      return trackId;
    },
    [set]
  );

  return {
    currentTrackId,
    userQueue,
    autoQueue,
    hasNext,
    hasPrevious,
    previousTrackId,
    initialSavedTime,
    initializeQueue,
    addToQueue,
    insertNext,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    advanceQueue,
    rewindQueue,
    skipToQueueItem,
    persistTime,
  };
}

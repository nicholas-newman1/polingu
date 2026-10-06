import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ListeningQueueItem,
  ListeningSettings,
  ListeningSessionMeta,
} from '../types/listening';
import { DEFAULT_LISTENING_SETTINGS } from '../types/listening';
import { loadListeningSettings } from '../lib/storage/loadListeningSettings';
import saveListeningSettings from '../lib/storage/saveListeningSettings';
import { useAuthContext } from '../hooks/useAuthContext';
import { emitAudioModeEvent, subscribeAudioModeEvent } from '../lib/audio/audioModeBus';
import { showSaveError } from '../lib/storage/errorHandler';

interface ListeningStartOptions {
  meta: ListeningSessionMeta;
  startIndex?: number;
}

interface ListeningContextType {
  isActive: boolean;
  isPlaying: boolean;
  queue: ListeningQueueItem[];
  currentIndex: number;
  currentItem: ListeningQueueItem | null;
  currentRepetition: number;
  meta: ListeningSessionMeta | null;
  settings: ListeningSettings;
  settingsLoading: boolean;
  start: (queue: ListeningQueueItem[], options: ListeningStartOptions) => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  updateSettings: (updates: Partial<ListeningSettings>) => Promise<void>;
}

const ListeningContext = createContext<ListeningContextType | null>(null);

type AfterEnded =
  | { type: 'finish' }
  | { type: 'repeat'; gapMs: number }
  | { type: 'advance'; gapMs: number };

/** After a clip ends: repeat it, move to the next card (after the configured gap), or finish. */
function decideAfterEnded(
  queue: ListeningQueueItem[],
  index: number,
  repetition: number,
  settings: ListeningSettings
): AfterEnded {
  const item = queue[index];
  if (!item) return { type: 'finish' };
  const group = item.isLearned ? settings.learned : settings.unknown;
  if (repetition < group.repetitions) {
    return { type: 'repeat', gapMs: group.gapBetweenRepetitions * 1000 };
  }
  if (index + 1 >= queue.length) return { type: 'finish' };
  return { type: 'advance', gapMs: group.gapBetweenCards * 1000 };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useListening(): ListeningContextType {
  const ctx = useContext(ListeningContext);
  if (!ctx) throw new Error('useListening must be used within ListeningProvider');
  return ctx;
}

export function ListeningProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState<ListeningSettings>(DEFAULT_LISTENING_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [queue, setQueue] = useState<ListeningQueueItem[]>([]);
  const [meta, setMeta] = useState<ListeningSessionMeta | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const [pauseToken, setPauseToken] = useState(0);
  const [stopToken, setStopToken] = useState(0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repetitionRef = useRef(currentRepetition);
  const isActiveRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    repetitionRef.current = currentRepetition;
  }, [currentRepetition]);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      loadListeningSettings().then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setSettingsLoading(false);
        }
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setSettings(DEFAULT_LISTENING_SETTINGS);
          setSettingsLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    setQueue([]);
    setMeta(null);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsPlaying(false);
  }, []);

  const currentItem = queue[currentIndex] ?? null;
  const currentAudioUrl = currentItem?.audioUrl ?? '';

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    let ended = false;

    const handleEnded = () => {
      if (!isActiveRef.current) return;
      ended = true;
      const idx = indexRef.current;
      const rep = repetitionRef.current;
      const decision = decideAfterEnded(queueRef.current, idx, rep, settingsRef.current);
      if (decision.type === 'finish') {
        isActiveRef.current = false;
        resetSession();
        return;
      }
      clearPendingTimer();
      setIsPlaying(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (decision.type === 'repeat') {
          setCurrentRepetition(rep + 1);
        } else {
          setCurrentIndex(idx + 1);
          setCurrentRepetition(1);
        }
        setPlayToken((t) => t + 1);
      }, decision.gapMs);
    };

    const handlePlay = () => {
      ended = false;
      setIsPlaying(true);
    };
    const handlePause = () => {
      if (ended) {
        ended = false;
        return;
      }
      if (timerRef.current === null) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    const unsubscribe = subscribeAudioModeEvent('audio-started', () => {
      if (isActiveRef.current) {
        clearPendingTimer();
        audio.pause();
        setIsPlaying(false);
      }
    });

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      unsubscribe();
      clearPendingTimer();
    };
  }, [clearPendingTimer, resetSession]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    audio.playbackRate = settings.playbackRate;
  }, [settings.playbackRate]);

  useEffect(() => {
    if (playToken === 0) return;
    const audio = audioElRef.current;
    if (!audio) return;
    if (!isActiveRef.current) return;
    if (!currentAudioUrl) return;
    if (audio.getAttribute('src') !== currentAudioUrl) {
      audio.setAttribute('src', currentAudioUrl);
      audio.load();
    }
    audio.currentTime = 0;
    audio.playbackRate = settingsRef.current.playbackRate;
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((err) => console.error('listening audio play failed', err));
    }
  }, [playToken, currentAudioUrl]);

  useEffect(() => {
    if (pauseToken === 0) return;
    const audio = audioElRef.current;
    if (!audio) return;
    clearPendingTimer();
    audio.pause();
  }, [pauseToken, clearPendingTimer]);

  useEffect(() => {
    if (stopToken === 0) return;
    const audio = audioElRef.current;
    if (!audio) return;
    clearPendingTimer();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, [stopToken, clearPendingTimer]);

  const jumpTo = useCallback((index: number) => {
    emitAudioModeEvent('listening-started');
    indexRef.current = index;
    repetitionRef.current = 1;
    setCurrentIndex(index);
    setCurrentRepetition(1);
    setIsPlaying(true);
    setPlayToken((t) => t + 1);
  }, []);

  const start = useCallback(
    (newQueue: ListeningQueueItem[], options: ListeningStartOptions) => {
      if (newQueue.length === 0) return;
      clearPendingTimer();
      queueRef.current = newQueue;
      isActiveRef.current = true;
      setQueue(newQueue);
      setMeta(options.meta);
      jumpTo(Math.min(Math.max(options.startIndex ?? 0, 0), newQueue.length - 1));
    },
    [clearPendingTimer, jumpTo]
  );

  const stop = useCallback(() => {
    clearPendingTimer();
    isActiveRef.current = false;
    setStopToken((t) => t + 1);
    resetSession();
  }, [clearPendingTimer, resetSession]);

  const play = useCallback(() => {
    if (!isActiveRef.current) return;
    emitAudioModeEvent('listening-started');
    setIsPlaying(true);
    setPlayToken((t) => t + 1);
  }, []);

  const pause = useCallback(() => {
    setPauseToken((t) => t + 1);
  }, []);

  const togglePlay = useCallback(() => {
    if (!isActiveRef.current) return;
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const next = useCallback(() => {
    if (!isActiveRef.current) return;
    clearPendingTimer();
    const nextIdx = indexRef.current + 1;
    if (nextIdx >= queueRef.current.length) {
      stop();
      return;
    }
    jumpTo(nextIdx);
  }, [clearPendingTimer, stop, jumpTo]);

  const previous = useCallback(() => {
    if (!isActiveRef.current) return;
    clearPendingTimer();
    jumpTo(Math.max(0, indexRef.current - 1));
  }, [clearPendingTimer, jumpTo]);

  const updateSettings = useCallback(async (updates: Partial<ListeningSettings>) => {
    const nextSettings: ListeningSettings = {
      ...settingsRef.current,
      ...updates,
      learned: { ...settingsRef.current.learned, ...(updates.learned ?? {}) },
      unknown: { ...settingsRef.current.unknown, ...(updates.unknown ?? {}) },
    };
    setSettings(nextSettings);
    try {
      await saveListeningSettings(nextSettings);
    } catch (e) {
      showSaveError(e);
    }
  }, []);

  const value = useMemo<ListeningContextType>(
    () => ({
      isActive: queue.length > 0,
      isPlaying,
      queue,
      currentIndex,
      currentItem,
      currentRepetition,
      meta,
      settings,
      settingsLoading,
      start,
      stop,
      play,
      pause,
      togglePlay,
      next,
      previous,
      updateSettings,
    }),
    [
      queue,
      isPlaying,
      currentIndex,
      currentItem,
      currentRepetition,
      meta,
      settings,
      settingsLoading,
      start,
      stop,
      play,
      pause,
      togglePlay,
      next,
      previous,
      updateSettings,
    ]
  );

  return (
    <ListeningContext.Provider value={value}>
      {children}
      <audio ref={audioElRef} preload="auto" style={{ display: 'none' }} />
    </ListeningContext.Provider>
  );
}

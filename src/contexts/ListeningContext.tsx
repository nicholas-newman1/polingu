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

  const currentItem = queue[currentIndex] ?? null;
  const currentAudioUrl = currentItem?.audioUrl ?? '';

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    let ended = false;

    const handleEnded = () => {
      if (!isActiveRef.current) return;
      ended = true;
      const q = queueRef.current;
      const idx = indexRef.current;
      const rep = repetitionRef.current;
      const item = q[idx];
      if (!item) {
        isActiveRef.current = false;
        setQueue([]);
        setMeta(null);
        setCurrentIndex(0);
        setCurrentRepetition(1);
        setIsPlaying(false);
        return;
      }
      const group = item.isLearned ? settingsRef.current.learned : settingsRef.current.unknown;
      const totalReps = group.repetitions;
      if (rep < totalReps) {
        const gap = group.gapBetweenRepetitions * 1000;
        clearPendingTimer();
        setIsPlaying(true);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setCurrentRepetition(rep + 1);
          setPlayToken((t) => t + 1);
        }, gap);
        return;
      }
      if (idx + 1 >= q.length) {
        isActiveRef.current = false;
        setQueue([]);
        setMeta(null);
        setCurrentIndex(0);
        setCurrentRepetition(1);
        setIsPlaying(false);
        return;
      }
      const gap = group.gapBetweenCards * 1000;
      clearPendingTimer();
      setIsPlaying(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCurrentIndex(idx + 1);
        setCurrentRepetition(1);
        setPlayToken((t) => t + 1);
      }, gap);
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
  }, [clearPendingTimer]);

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

  const start = useCallback(
    (newQueue: ListeningQueueItem[], options: ListeningStartOptions) => {
      if (newQueue.length === 0) return;
      clearPendingTimer();
      emitAudioModeEvent('listening-started');
      const startIdx = Math.min(Math.max(options.startIndex ?? 0, 0), newQueue.length - 1);
      queueRef.current = newQueue;
      indexRef.current = startIdx;
      repetitionRef.current = 1;
      isActiveRef.current = true;
      setQueue(newQueue);
      setMeta(options.meta);
      setCurrentIndex(startIdx);
      setCurrentRepetition(1);
      setIsPlaying(true);
      setPlayToken((t) => t + 1);
    },
    [clearPendingTimer]
  );

  const stop = useCallback(() => {
    clearPendingTimer();
    isActiveRef.current = false;
    setStopToken((t) => t + 1);
    setQueue([]);
    setMeta(null);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsPlaying(false);
  }, [clearPendingTimer]);

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
    emitAudioModeEvent('listening-started');
    indexRef.current = nextIdx;
    repetitionRef.current = 1;
    setCurrentIndex(nextIdx);
    setCurrentRepetition(1);
    setIsPlaying(true);
    setPlayToken((t) => t + 1);
  }, [clearPendingTimer, stop]);

  const previous = useCallback(() => {
    if (!isActiveRef.current) return;
    clearPendingTimer();
    const prevIdx = Math.max(0, indexRef.current - 1);
    emitAudioModeEvent('listening-started');
    indexRef.current = prevIdx;
    repetitionRef.current = 1;
    setCurrentIndex(prevIdx);
    setCurrentRepetition(1);
    setIsPlaying(true);
    setPlayToken((t) => t + 1);
  }, [clearPendingTimer]);

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

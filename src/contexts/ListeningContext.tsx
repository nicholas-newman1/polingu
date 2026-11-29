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
import { listeningSettingsDoc } from '../lib/storage/userDocs';
import { useUserDoc } from '../hooks/useUserDoc';
import { emitAudioModeEvent, subscribeAudioModeEvent } from '../lib/audio/audioModeBus';

interface ListeningStartOptions {
  meta: ListeningSessionMeta;
}

interface ListeningContextType {
  isActive: boolean;
  isPlaying: boolean;
  queue: ListeningQueueItem[];
  currentIndex: number;
  currentItem: ListeningQueueItem | null;
  currentRepetition: number;
  /** How many times the current card plays. */
  totalRepetitions: number;
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

/** Learned and unfamiliar cards each have their own repetitions and gaps. */
function playbackGroupFor(item: ListeningQueueItem, settings: ListeningSettings) {
  return item.isLearned ? settings.learned : settings.unknown;
}

/** After a clip ends: repeat it, move to the next card (after the configured gap), or finish. */
function decideAfterEnded(
  queue: ListeningQueueItem[],
  index: number,
  repetition: number,
  settings: ListeningSettings
): AfterEnded {
  const item = queue[index];
  if (!item) return { type: 'finish' };
  const group = playbackGroupFor(item, settings);
  if (repetition < group.repetitions) {
    return { type: 'repeat', gapMs: group.gapBetweenRepetitions * 1000 };
  }
  if (index + 1 >= queue.length) return { type: 'finish' };
  return { type: 'advance', gapMs: group.gapBetweenCards * 1000 };
}

export function useListening(): ListeningContextType {
  const ctx = useContext(ListeningContext);
  if (!ctx) throw new Error('useListening must be used within ListeningProvider');
  return ctx;
}

export function ListeningProvider({ children }: { children: ReactNode }) {
  const {
    value: settings,
    loading: settingsLoading,
    update: saveSettings,
  } = useUserDoc(listeningSettingsDoc);

  const [queue, setQueue] = useState<ListeningQueueItem[]>([]);
  const [meta, setMeta] = useState<ListeningSessionMeta | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  // The element's listeners read the session from these; each is written along with its state.
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repetitionRef = useRef(currentRepetition);
  const isActiveRef = useRef(false);
  // Settings are also loaded from storage, not only set by updateSettings, so this follows them.
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    queueRef.current = [];
    indexRef.current = 0;
    repetitionRef.current = 1;
    setQueue([]);
    setMeta(null);
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setIsPlaying(false);
  }, []);

  /** Plays one repetition of a card in the queue, from the start. */
  const playClip = useCallback((index: number, repetition: number) => {
    indexRef.current = index;
    repetitionRef.current = repetition;
    setCurrentIndex(index);
    setCurrentRepetition(repetition);
    setIsPlaying(true);

    const audio = audioElRef.current;
    const url = queueRef.current[index]?.audioUrl;
    if (!audio || !isActiveRef.current || !url) return;
    if (audio.getAttribute('src') !== url) {
      audio.setAttribute('src', url);
      audio.load();
    }
    audio.currentTime = 0;
    audio.playbackRate = settingsRef.current.playbackRate;
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((err) => console.error('listening audio play failed', err));
    }
  }, []);

  const currentItem = queue[currentIndex] ?? null;

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
          playClip(idx, rep + 1);
        } else {
          playClip(idx + 1, 1);
        }
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
  }, [clearPendingTimer, resetSession, playClip]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    audio.playbackRate = settings.playbackRate;
  }, [settings.playbackRate]);

  const jumpTo = useCallback(
    (index: number) => {
      emitAudioModeEvent('listening-started');
      playClip(index, 1);
    },
    [playClip]
  );

  const start = useCallback(
    (newQueue: ListeningQueueItem[], options: ListeningStartOptions) => {
      if (newQueue.length === 0) return;
      clearPendingTimer();
      queueRef.current = newQueue;
      isActiveRef.current = true;
      setQueue(newQueue);
      setMeta(options.meta);
      jumpTo(0);
    },
    [clearPendingTimer, jumpTo]
  );

  const stop = useCallback(() => {
    clearPendingTimer();
    isActiveRef.current = false;
    const audio = audioElRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    resetSession();
  }, [clearPendingTimer, resetSession]);

  const play = useCallback(() => {
    if (!isActiveRef.current) return;
    emitAudioModeEvent('listening-started');
    playClip(indexRef.current, repetitionRef.current);
  }, [playClip]);

  const pause = useCallback(() => {
    // In the gap between clips the element is already paused, so no `pause` event follows.
    setIsPlaying(false);
    clearPendingTimer();
    audioElRef.current?.pause();
  }, [clearPendingTimer]);

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

  const updateSettings = useCallback(
    (updates: Partial<ListeningSettings>) =>
      saveSettings({
        ...settingsRef.current,
        ...updates,
        learned: { ...settingsRef.current.learned, ...(updates.learned ?? {}) },
        unknown: { ...settingsRef.current.unknown, ...(updates.unknown ?? {}) },
      }),
    [saveSettings]
  );

  const totalRepetitions = currentItem ? playbackGroupFor(currentItem, settings).repetitions : 0;

  const value = useMemo<ListeningContextType>(
    () => ({
      isActive: queue.length > 0,
      isPlaying,
      queue,
      currentIndex,
      currentItem,
      currentRepetition,
      totalRepetitions,
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
      totalRepetitions,
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

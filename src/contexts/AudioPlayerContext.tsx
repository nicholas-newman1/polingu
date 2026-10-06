import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { subscribeToAudioItem, subscribeToSystemAudioItem } from '../lib/audio';
import type { AudioItem, SystemAudioItem, TranscriptSegment } from '../types/audio';
import { useQueueManager, type QueueManager } from '../hooks/useQueueManager';
import { subscribeAudioModeEvent } from '../lib/audio/audioModeBus';
import { useAudioLibrary } from './audioPlayer/useAudioLibrary';
import { useAudioUrlResolver } from './audioPlayer/useAudioUrlResolver';
import { promotePreloaded, usePreloadTrack, type PreloadedTrack } from './audioPlayer/preloadSlots';
import { syncPositionState, useMediaSession } from './audioPlayer/useMediaSession';
import { usePersistPlaybackTime } from './audioPlayer/usePersistPlaybackTime';
import { usePlaybackEvents } from './audioPlayer/usePlaybackEvents';

type AnyAudioItem = AudioItem | SystemAudioItem;

function subscribeToAnyAudioItem(
  audioId: string,
  isSystemTrack: boolean,
  callback: (item: AnyAudioItem | null) => void
) {
  return isSystemTrack
    ? subscribeToSystemAudioItem(audioId, callback)
    : subscribeToAudioItem(audioId, callback);
}

interface AudioPlayerState {
  activeAudioId: string | null;
  audioItem: AnyAudioItem | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeSegmentIndex: number;
  activeWordIndex: number;
  playbackRate: number;
  loading: boolean;
  error: string | null;
}

interface AudioPlayerActions {
  loadTrack: (audioId: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  playFromLibrary: (trackId: string, readyItems: Array<{ id: string }>) => void;
}

interface AudioLibraryState {
  items: AudioItem[];
  systemItems: SystemAudioItem[];
  libraryLoading: boolean;
}

type AudioPlayerContextType = AudioPlayerState &
  AudioPlayerActions &
  AudioLibraryState &
  QueueManager;

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAudioPlayerContext() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  return ctx;
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioElARef = useRef<HTMLAudioElement | null>(null);
  const audioElBRef = useRef<HTMLAudioElement | null>(null);
  const audioElCRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const prevPreloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedTrackRef = useRef<PreloadedTrack | null>(null);
  const prevPreloadedTrackRef = useRef<PreloadedTrack | null>(null);
  const skipLoadRef = useRef(false);
  const rafRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const unsubItemRef = useRef<(() => void) | null>(null);
  const playNextRef = useRef<() => void>(null);
  const autoPlayRef = useRef(true);
  const restoredRef = useRef(false);

  useEffect(() => {
    audioRef.current = audioElARef.current;
    preloadRef.current = audioElBRef.current;
    prevPreloadRef.current = audioElCRef.current;
  }, []);

  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioItem, setAudioItem] = useState<AnyAudioItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const playbackRateRef = useRef(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items, systemItems, systemItemsRef, libraryLoading } = useAudioLibrary();

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const queueManager = useQueueManager();
  const { initializeQueue, advanceQueue, rewindQueue, persistTime, flushTime } = queueManager;
  const restoreTimeRef = useRef<number>(0);
  const activeAudioIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeAudioIdRef.current = activeAudioId;
  }, [activeAudioId]);

  const resetPlayerState = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioUrl(null);
    setIsPlaying(autoPlayRef.current);
    setCurrentTime(0);
    setDuration(0);
    setActiveSegmentIndex(-1);
    setActiveWordIndex(-1);
    setError(null);
    transcriptRef.current = [];
  }, []);

  const resolveAudioUrl = useAudioUrlResolver(audioUrlRef);

  const loadTrackInternal = useCallback(
    (audioId: string, force = false, autoPlay = true) => {
      if (audioId === activeAudioIdRef.current && !force) return;
      autoPlayRef.current = autoPlay;
      unsubItemRef.current?.();

      const cachedItem: AnyAudioItem | undefined =
        items.find((i) => i.id === audioId) ?? systemItemsRef.current.find((i) => i.id === audioId);
      const isSystemTrack = systemItemsRef.current.some((i) => i.id === audioId);

      if (cachedItem?.status === 'ready' && cachedItem.storagePath) {
        const outgoing =
          activeAudioIdRef.current && audioUrlRef.current
            ? { id: activeAudioIdRef.current, url: audioUrlRef.current }
            : null;
        const preloadedUrl = promotePreloaded(
          { audioRef, preloadRef, prevPreloadRef, preloadedTrackRef, prevPreloadedTrackRef },
          audioId,
          outgoing
        );
        if (preloadedUrl) skipLoadRef.current = true;

        setActiveAudioId(audioId);
        setAudioItem(cachedItem);
        transcriptRef.current = cachedItem.transcript ?? [];
        cancelAnimationFrame(rafRef.current);
        setCurrentTime(0);
        setDuration(0);
        setActiveSegmentIndex(-1);
        setActiveWordIndex(-1);
        setError(null);

        if (preloadedUrl) {
          setAudioUrl(preloadedUrl);
          setLoading(false);
        } else {
          setLoading(true);
          resolveAudioUrl(audioId, cachedItem.storagePath)
            .then((url) => {
              setAudioUrl(url);
              setLoading(false);
            })
            .catch(() => {
              setError('Failed to load audio file.');
              setLoading(false);
            });
        }

        unsubItemRef.current = subscribeToAnyAudioItem(audioId, isSystemTrack, (item) => {
          if (item) {
            setAudioItem(item);
            if (item.transcript) transcriptRef.current = item.transcript;
          }
        });
        return;
      }

      resetPlayerState();
      setActiveAudioId(audioId);
      setLoading(true);

      unsubItemRef.current = subscribeToAnyAudioItem(audioId, isSystemTrack, async (item) => {
        setAudioItem(item);
        if (item?.transcript) {
          transcriptRef.current = item.transcript;
        }

        if (item?.status === 'ready' && item.storagePath) {
          try {
            const url = await resolveAudioUrl(item.id, item.storagePath);
            setAudioUrl(url);
          } catch {
            setError('Failed to load audio file.');
          }
          setLoading(false);
        } else if (item?.status === 'error') {
          setError(item.error || 'Processing failed.');
          setLoading(false);
        } else if (!item) {
          setError('Audio item not found.');
          setLoading(false);
        }
      });
    },
    [resetPlayerState, items, systemItemsRef, resolveAudioUrl]
  );

  const loadTrack = useCallback(
    (audioId: string) => {
      loadTrackInternal(audioId);
    },
    [loadTrackInternal]
  );

  useEffect(() => {
    if (restoredRef.current || libraryLoading || !queueManager.currentTrackId) return;
    if (activeAudioIdRef.current) return;
    const trackId = queueManager.currentTrackId;
    const item =
      items.find((i) => i.id === trackId && i.status === 'ready') ??
      systemItems.find((i) => i.id === trackId && i.status === 'ready');
    if (!item) return;
    restoredRef.current = true;
    restoreTimeRef.current = queueManager.initialSavedTime;
    queueMicrotask(() => loadTrackInternal(trackId, false, false));
  }, [
    libraryLoading,
    items,
    systemItems,
    queueManager.currentTrackId,
    queueManager.initialSavedTime,
    loadTrackInternal,
  ]);

  const playFromLibrary = useCallback(
    (trackId: string, readyItems: Array<{ id: string }>) => {
      const trackIds = readyItems.map((i) => i.id);
      const startIndex = trackIds.indexOf(trackId);
      if (startIndex === -1) return;
      initializeQueue(trackIds, startIndex);
      loadTrackInternal(trackId, true);
    },
    [loadTrackInternal, initializeQueue]
  );

  const nextTrack = useCallback(() => {
    const nextId = advanceQueue();
    if (nextId) {
      loadTrackInternal(nextId, true);
    }
  }, [advanceQueue, loadTrackInternal]);

  const previousTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevId = rewindQueue();
    if (prevId) {
      loadTrackInternal(prevId, true);
    }
  }, [rewindQueue, loadTrackInternal]);

  useEffect(() => {
    playNextRef.current = nextTrack;
  }, [nextTrack]);

  useEffect(() => {
    return () => {
      unsubItemRef.current?.();
    };
  }, []);

  const { userQueue, autoQueue, previousTrackId } = queueManager;
  const nextQueueTrackId = userQueue[0] ?? autoQueue[0] ?? null;

  usePreloadTrack({
    trackId: nextQueueTrackId,
    items,
    systemItems,
    elementRef: preloadRef,
    trackRef: preloadedTrackRef,
    resolveAudioUrl,
  });
  usePreloadTrack({
    trackId: previousTrackId,
    items,
    systemItems,
    elementRef: prevPreloadRef,
    trackRef: prevPreloadedTrackRef,
    resolveAudioUrl,
  });

  usePlaybackEvents({
    audioRef,
    audioUrl,
    skipLoadRef,
    playbackRateRef,
    transcriptRef,
    rafRef,
    restoreTimeRef,
    autoPlayRef,
    playNextRef,
    persistTime,
    flushTime,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    setActiveSegmentIndex,
    setActiveWordIndex,
  });

  usePersistPlaybackTime(audioRef, activeAudioId, isPlaying, persistTime, flushTime);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    return subscribeAudioModeEvent('listening-started', () => {
      audioRef.current?.pause();
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
      syncPositionState(audio);
    }
  }, []);

  useMediaSession(audioRef, audioItem?.title, nextTrack, previousTrack);

  const value: AudioPlayerContextType = {
    activeAudioId,
    audioItem,
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    activeWordIndex,
    playbackRate,
    loading,
    error,
    items,
    systemItems,
    libraryLoading,
    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    nextTrack,
    previousTrack,
    playFromLibrary,
    ...queueManager,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio ref={audioElARef} preload="auto" />
      <audio ref={audioElBRef} preload="auto" />
      <audio ref={audioElCRef} preload="auto" />
      {children}
    </AudioPlayerContext.Provider>
  );
}

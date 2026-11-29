import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { subscribeToAudioItem, subscribeToSystemAudioItem } from '../lib/audio';
import type { AudioItem, SystemAudioItem, TranscriptSegment } from '../types/audio';
import { useQueueManager, type QueueManager, type QueueSection } from '../hooks/useQueueManager';
import { subscribeAudioModeEvent } from '../lib/audio/audioModeBus';
import { useAudioLibrary } from './audioPlayer/useAudioLibrary';
import { useAudioUrlResolver } from './audioPlayer/useAudioUrlResolver';
import { promotePreloaded, usePreloadTrack, type PreloadedTrack } from './audioPlayer/preloadSlots';
import { syncPositionState, useMediaSession } from './audioPlayer/useMediaSession';
import { usePersistPlaybackTime } from './audioPlayer/usePersistPlaybackTime';
import { usePlaybackEvents, type PlaybackHandles } from './audioPlayer/usePlaybackEvents';

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
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeSegmentIndex: number;
  playbackRate: number;
  loading: boolean;
  error: string | null;
}

interface AudioPlayerActions {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  /** Seeks relative to the element's actual position (not the throttled `currentTime`). */
  seekBy: (delta: number) => void;
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

type QueueControls = Pick<
  QueueManager,
  | 'userQueue'
  | 'autoQueue'
  | 'hasNext'
  | 'hasPrevious'
  | 'addToQueue'
  | 'insertNext'
  | 'removeFromQueue'
  | 'reorderQueue'
  | 'skipToQueueItem'
>;

type AudioPlayerContextType = AudioPlayerState &
  AudioPlayerActions &
  AudioLibraryState &
  QueueControls;

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

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
  // The playback listeners call the latest nextTrack without being reattached when it changes.
  const playNextRef = useRef<() => void>(null);
  const autoPlayRef = useRef(true);
  const restoredRef = useRef(false);
  const restoreTimeRef = useRef<number>(0);
  // Read by the playback listeners after each load(), which resets the element's rate.
  const playbackRateRef = useRef(1);

  useEffect(() => {
    audioRef.current = audioElARef.current;
    preloadRef.current = audioElBRef.current;
    prevPreloadRef.current = audioElCRef.current;
  }, []);

  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioItem, setAudioItem] = useState<AnyAudioItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // The URL resolver checks it after awaiting, so it can't use the value from when it was called.
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items, systemItems, libraryLoading } = useAudioLibrary();

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const {
    currentTrackId,
    initialSavedTime,
    userQueue,
    autoQueue,
    previousTrackId,
    hasNext,
    hasPrevious,
    initializeQueue,
    addToQueue,
    insertNext,
    removeFromQueue,
    reorderQueue,
    advanceQueue,
    rewindQueue,
    skipToQueueItem,
    persistTime,
    flushTime,
  } = useQueueManager();

  /**
   * Stops the outgoing track when switching. The queue already names the new track, so the stop
   * must not reach the playback listeners, which would save its position as the new track's:
   * clearing the URL lets the playback effect detach them before pausing. With no URL loaded no
   * listeners are attached, and the element is paused directly.
   */
  const stopOutgoingTrack = useCallback(() => {
    if (!audioUrlRef.current) audioRef.current?.pause();
    setAudioUrl(null);
  }, []);

  const resolveAudioUrl = useAudioUrlResolver(audioUrlRef);

  const loadTrackInternal = useCallback(
    (audioId: string, force = false, autoPlay = true) => {
      if (audioId === activeAudioId && !force) return;
      autoPlayRef.current = autoPlay;
      unsubItemRef.current?.();

      const cachedItem: AnyAudioItem | undefined =
        items.find((i) => i.id === audioId) ?? systemItems.find((i) => i.id === audioId);
      const isSystemTrack = systemItems.some((i) => i.id === audioId);
      // A track the library already lists as ready starts at once; any other waits for its document.
      const readyItem =
        cachedItem?.status === 'ready' && cachedItem.storagePath ? cachedItem : null;

      const outgoing =
        activeAudioId && audioUrlRef.current
          ? { id: activeAudioId, url: audioUrlRef.current }
          : null;
      const preloadedUrl =
        readyItem &&
        promotePreloaded(
          { audioRef, preloadRef, prevPreloadRef, preloadedTrackRef, prevPreloadedTrackRef },
          audioId,
          outgoing
        );

      const loadUrl = (storagePath: string) => {
        resolveAudioUrl(audioId, storagePath).then(
          (url) => {
            setAudioUrl(url);
            setLoading(false);
          },
          () => {
            setError('Failed to load audio file.');
            setLoading(false);
          }
        );
      };

      cancelAnimationFrame(rafRef.current);
      setActiveAudioId(audioId);
      setCurrentTime(0);
      setDuration(0);
      setActiveSegmentIndex(-1);
      setError(null);
      transcriptRef.current = readyItem?.transcript ?? [];

      if (preloadedUrl) {
        skipLoadRef.current = true;
        setAudioUrl(preloadedUrl);
        setLoading(false);
      } else {
        // Now, rather than once the new URL resolves (if it does).
        stopOutgoingTrack();
        setLoading(true);
      }

      if (readyItem) {
        setAudioItem(readyItem);
        if (!preloadedUrl) loadUrl(readyItem.storagePath);
      } else {
        setIsPlaying(autoPlay);
      }

      unsubItemRef.current = subscribeToAnyAudioItem(audioId, isSystemTrack, (item) => {
        if (item?.transcript) transcriptRef.current = item.transcript;
        if (readyItem) {
          if (item) setAudioItem(item);
          return;
        }

        setAudioItem(item);
        if (item?.status === 'ready' && item.storagePath) {
          loadUrl(item.storagePath);
        } else if (item?.status === 'error') {
          setError(item.error || 'Processing failed.');
          setLoading(false);
        } else if (!item) {
          setError('Audio item not found.');
          setLoading(false);
        }
      });
    },
    [activeAudioId, items, systemItems, stopOutgoingTrack, resolveAudioUrl]
  );

  useEffect(() => {
    if (restoredRef.current || libraryLoading || !currentTrackId || activeAudioId) return;
    const item =
      items.find((i) => i.id === currentTrackId && i.status === 'ready') ??
      systemItems.find((i) => i.id === currentTrackId && i.status === 'ready');
    if (!item) return;
    restoredRef.current = true;
    restoreTimeRef.current = initialSavedTime;
    queueMicrotask(() => loadTrackInternal(currentTrackId, false, false));
  }, [
    libraryLoading,
    items,
    systemItems,
    currentTrackId,
    initialSavedTime,
    activeAudioId,
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

  const skipToQueueItemAndPlay = useCallback(
    (section: QueueSection, index: number) => {
      const trackId = skipToQueueItem(section, index);
      if (trackId) loadTrackInternal(trackId, true);
      return trackId;
    },
    [skipToQueueItem, loadTrackInternal]
  );

  useEffect(() => {
    playNextRef.current = nextTrack;
  }, [nextTrack]);

  useEffect(() => {
    return () => {
      unsubItemRef.current?.();
    };
  }, []);

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

  const playbackHandles = useMemo<PlaybackHandles>(
    () => ({
      audioRef,
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
    }),
    [persistTime, flushTime]
  );
  usePlaybackEvents(audioUrl, playbackHandles);

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
    setCurrentTime(audio.currentTime);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const max = Number.isFinite(audio.duration) ? audio.duration : Infinity;
      seek(Math.max(0, Math.min(max, audio.currentTime + delta)));
    },
    [seek]
  );

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
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    playbackRate,
    loading,
    error,
    items,
    systemItems,
    libraryLoading,
    play,
    pause,
    togglePlay,
    seek,
    seekBy,
    setPlaybackRate,
    nextTrack,
    previousTrack,
    playFromLibrary,
    userQueue,
    autoQueue,
    hasNext,
    hasPrevious,
    addToQueue,
    insertNext,
    removeFromQueue,
    reorderQueue,
    skipToQueueItem: skipToQueueItemAndPlay,
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

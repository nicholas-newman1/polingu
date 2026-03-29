import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  startTransition,
  type ReactNode,
} from 'react';
import {
  subscribeToAudioItem,
  getAudioDownloadUrl,
  getAudioItems,
  subscribeToAudioItemsUpdates,
  getCachedAudioBlob,
  cacheAudioBlob,
} from '../lib/audio';
import type { AudioItem, TranscriptSegment } from '../types/audio';
import { useQueueManager, type QueueManager } from '../hooks/useQueueManager';

function binarySearchSegment(segments: TranscriptSegment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (segments[mid].startTime <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result >= 0 && time <= segments[result].endTime ? result : -1;
}

function findActiveWord(segment: TranscriptSegment, time: number): number {
  const { words } = segment;
  if (words.length === 0) return -1;
  let lo = 0;
  let hi = words.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid].startTime <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result >= 0 && time <= words[result].endTime ? result : -1;
}

interface AudioPlayerState {
  activeAudioId: string | null;
  audioItem: AudioItem | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeSegmentIndex: number;
  activeWordIndex: number;
  playbackRate: number;
  hasStartedPlayback: boolean;
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
  setHasStartedPlayback: (value: boolean) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  playFromLibrary: (trackId: string, readyItems: AudioItem[]) => void;
}

interface AudioLibraryState {
  items: AudioItem[];
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const unsubItemRef = useRef<(() => void) | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const playNextRef = useRef<() => void>(null);
  const autoPlayRef = useRef(true);
  const restoredRef = useRef(false);

  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioItem, setAudioItem] = useState<AudioItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const playbackRateRef = useRef(1);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<AudioItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  function syncPositionState() {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio || !audio.duration || isNaN(audio.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch {
      // ignore
    }
  }

  const queueManager = useQueueManager();
  const { initializeQueue, advanceQueue, rewindQueue, persistTime } = queueManager;
  const restoreTimeRef = useRef<number>(0);
  const activeAudioIdRef = useRef<string | null>(null);
  activeAudioIdRef.current = activeAudioId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAudioItems();
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error('Failed to load audio items:', err);
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();

    const unsubscribe = subscribeToAudioItemsUpdates((updatedItems) => {
      if (!cancelled) setItems(updatedItems);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const resetPlayerState = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioUrl(null);
    setIsPlaying(autoPlayRef.current);
    setHasStartedPlayback(autoPlayRef.current);
    setCurrentTime(0);
    setDuration(0);
    setActiveSegmentIndex(-1);
    setActiveWordIndex(-1);
    setError(null);
    transcriptRef.current = [];
  }, []);

  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  const resolveAudioUrl = useCallback(
    async (audioId: string, storagePath: string): Promise<string> => {
      const existingBlobUrl = blobUrlCacheRef.current.get(audioId);
      if (existingBlobUrl) return existingBlobUrl;

      const cachedBlob = await getCachedAudioBlob(audioId);
      if (cachedBlob) {
        const blobUrl = URL.createObjectURL(cachedBlob);
        blobUrlCacheRef.current.set(audioId, blobUrl);
        return blobUrl;
      }

      const signedUrl =
        urlCacheRef.current.get(storagePath) ?? (await getAudioDownloadUrl(storagePath));
      urlCacheRef.current.set(storagePath, signedUrl);

      fetch(signedUrl)
        .then((res) => res.blob())
        .then((blob) => cacheAudioBlob(audioId, blob))
        .catch(() => {});

      return signedUrl;
    },
    []
  );

  const loadTrackInternal = useCallback(
    (audioId: string, force = false, autoPlay = true) => {
      if (audioId === activeAudioIdRef.current && !force) return;
      autoPlayRef.current = autoPlay;

      unsubItemRef.current?.();
      resetPlayerState();
      setActiveAudioId(audioId);
      setLoading(true);

      const cachedItem = items.find((i) => i.id === audioId);

      if (cachedItem?.status === 'ready' && cachedItem.storagePath) {
        setAudioItem(cachedItem);
        transcriptRef.current = cachedItem.transcript ?? [];
        resolveAudioUrl(audioId, cachedItem.storagePath)
          .then((url) => {
            setAudioUrl(url);
            setLoading(false);
          })
          .catch(() => {
            setError('Failed to load audio file.');
            setLoading(false);
          });

        const unsubscribe = subscribeToAudioItem(audioId, (item) => {
          if (item) {
            setAudioItem(item);
            if (item.transcript) transcriptRef.current = item.transcript;
          }
        });
        unsubItemRef.current = unsubscribe;
        return;
      }

      const unsubscribe = subscribeToAudioItem(audioId, async (item) => {
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

      unsubItemRef.current = unsubscribe;
    },
    [resetPlayerState, items, resolveAudioUrl]
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
    const item = items.find((i) => i.id === trackId && i.status === 'ready');
    if (!item) return;
    restoredRef.current = true;
    restoreTimeRef.current = queueManager.initialSavedTime;
    loadTrackInternal(trackId, false, false);
  }, [
    libraryLoading,
    items,
    queueManager.currentTrackId,
    queueManager.initialSavedTime,
    loadTrackInternal,
  ]);

  const playFromLibrary = useCallback(
    (trackId: string, readyItems: AudioItem[]) => {
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

  playNextRef.current = () => {
    const nextId = advanceQueue();
    if (nextId) {
      loadTrackInternal(nextId, true);
    }
  };

  useEffect(() => {
    return () => {
      unsubItemRef.current?.();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.src = audioUrl;
    audio.playbackRate = playbackRateRef.current;
    audio.load();

    function computeIndices(time: number) {
      const segments = transcriptRef.current;
      const segIdx = binarySearchSegment(segments, time);
      const wordIdx = segIdx >= 0 ? findActiveWord(segments[segIdx], time) : -1;
      return { segIdx, wordIdx };
    }

    function loop() {
      if (!audio || audio.paused) return;
      const time = audio.currentTime;
      const { segIdx, wordIdx } = computeIndices(time);
      startTransition(() => {
        setCurrentTime(time);
        setActiveSegmentIndex(segIdx);
        setActiveWordIndex(wordIdx);
      });
      rafRef.current = requestAnimationFrame(loop);
    }

    const onPlay = () => {
      setIsPlaying(true);
      setHasStartedPlayback(true);
      rafRef.current = requestAnimationFrame(loop);
      syncPositionState();
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      persistTime(audio.currentTime);
      syncPositionState();
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      playNextRef.current?.();
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      if (restoreTimeRef.current > 0 && restoreTimeRef.current < audio.duration) {
        audio.currentTime = restoreTimeRef.current;
        setCurrentTime(restoreTimeRef.current);
        restoreTimeRef.current = 0;
      }
      syncPositionState();
    };
    const onSeeked = () => {
      const time = audio.currentTime;
      const { segIdx, wordIdx } = computeIndices(time);
      setCurrentTime(time);
      setActiveSegmentIndex(segIdx);
      setActiveWordIndex(wordIdx);
      syncPositionState();
    };
    const onCanPlay = () => {
      if (autoPlayRef.current) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('canplay', onCanPlay, { once: true });

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('canplay', onCanPlay);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioUrl, persistTime]);

  useEffect(() => {
    if (!isPlaying || !activeAudioId) return;
    const interval = setInterval(() => {
      const time = audioRef.current?.currentTime;
      if (time !== undefined) persistTime(time);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, activeAudioId, persistTime]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const time = audioRef.current?.currentTime;
      if (time !== undefined && activeAudioIdRef.current) {
        persistTime(time);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [persistTime]);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
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
      syncPositionState();
    }
  }, []);

  const nextTrackRef = useRef(nextTrack);
  const previousTrackRef = useRef(previousTrack);
  nextTrackRef.current = nextTrack;
  previousTrackRef.current = previousTrack;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
    navigator.mediaSession.setActionHandler('previoustrack', () => previousTrackRef.current());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime !== undefined) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          audioRef.current.currentTime - (details.seekOffset || 10)
        );
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + (details.seekOffset || 10)
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !audioItem) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: audioItem.title,
      artist: 'Polingu',
    });
  }, [audioItem]);

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
    hasStartedPlayback,
    loading,
    error,
    items,
    libraryLoading,
    loadTrack,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    setHasStartedPlayback,
    nextTrack,
    previousTrack,
    playFromLibrary,
    ...queueManager,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="auto" />
      {children}
    </AudioPlayerContext.Provider>
  );
}

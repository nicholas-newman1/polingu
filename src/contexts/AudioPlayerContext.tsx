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
  subscribeToAudioItemsUpdates,
  getCachedAudioItems,
  getCachedAudioBlob,
  cacheAudioBlob,
  subscribeToSystemAudioItems,
  subscribeToSystemAudioItem,
} from '../lib/audio';
import type { AudioItem, SystemAudioItem, TranscriptSegment } from '../types/audio';

type AnyAudioItem = AudioItem | SystemAudioItem;
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
  const preloadedTrackRef = useRef<{ id: string; url: string } | null>(null);
  const prevPreloadedTrackRef = useRef<{ id: string; url: string } | null>(null);
  const skipLoadRef = useRef(false);
  const rafRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const unsubItemRef = useRef<(() => void) | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
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

  const [items, setItems] = useState<AudioItem[]>([]);
  const [systemItems, setSystemItems] = useState<SystemAudioItem[]>([]);
  const systemItemsRef = useRef<SystemAudioItem[]>([]);
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

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const queueManager = useQueueManager();
  const { initializeQueue, advanceQueue, rewindQueue, persistTime } = queueManager;
  const restoreTimeRef = useRef<number>(0);
  const activeAudioIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeAudioIdRef.current = activeAudioId;
  }, [activeAudioId]);

  useEffect(() => {
    let cancelled = false;

    getCachedAudioItems().then((cached) => {
      if (!cancelled) {
        setItems(cached);
        setLibraryLoading(false);
      }
    });

    const unsubItems = subscribeToAudioItemsUpdates((updatedItems) => {
      if (!cancelled) {
        setItems(updatedItems);
        setLibraryLoading(false);
      }
    });

    const unsubSystem = subscribeToSystemAudioItems((updatedItems) => {
      if (!cancelled) {
        setSystemItems(updatedItems);
        systemItemsRef.current = updatedItems;
      }
    });

    return () => {
      cancelled = true;
      unsubItems();
      unsubSystem();
    };
  }, []);

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

      const cachedItem: AnyAudioItem | undefined =
        items.find((i) => i.id === audioId) ?? systemItemsRef.current.find((i) => i.id === audioId);
      const isSystemTrack = systemItemsRef.current.some((i) => i.id === audioId);

      const subscribeFn = isSystemTrack
        ? (id: string, cb: (item: AnyAudioItem | null) => void) =>
            subscribeToSystemAudioItem(id, cb)
        : subscribeToAudioItem;

      if (cachedItem?.status === 'ready' && cachedItem.storagePath) {
        const preloaded = preloadedTrackRef.current;
        const preloadEl = preloadRef.current;
        const isNextPreloaded = preloaded?.id === audioId && preloadEl && preloadEl.readyState >= 2;

        const prevPreloaded = prevPreloadedTrackRef.current;
        const prevPreloadEl = prevPreloadRef.current;
        const isPrevPreloaded =
          !isNextPreloaded &&
          prevPreloaded?.id === audioId &&
          prevPreloadEl &&
          prevPreloadEl.readyState >= 2;

        if (isNextPreloaded) {
          const oldActive = audioRef.current;
          const oldPrevPreload = prevPreloadRef.current;
          audioRef.current = preloadEl;
          prevPreloadRef.current = oldActive;
          preloadRef.current = oldPrevPreload;
          prevPreloadedTrackRef.current =
            activeAudioIdRef.current && audioUrlRef.current
              ? { id: activeAudioIdRef.current, url: audioUrlRef.current }
              : null;
          preloadedTrackRef.current = null;
          skipLoadRef.current = true;
        } else if (isPrevPreloaded) {
          const oldActive = audioRef.current;
          const oldNextPreload = preloadRef.current;
          audioRef.current = prevPreloadEl;
          preloadRef.current = oldActive;
          prevPreloadRef.current = oldNextPreload;
          preloadedTrackRef.current =
            activeAudioIdRef.current && audioUrlRef.current
              ? { id: activeAudioIdRef.current, url: audioUrlRef.current }
              : null;
          prevPreloadedTrackRef.current = null;
          skipLoadRef.current = true;
        }

        setActiveAudioId(audioId);
        setAudioItem(cachedItem);
        transcriptRef.current = cachedItem.transcript ?? [];
        cancelAnimationFrame(rafRef.current);
        setCurrentTime(0);
        setDuration(0);
        setActiveSegmentIndex(-1);
        setActiveWordIndex(-1);
        setError(null);

        if (isNextPreloaded) {
          setAudioUrl(preloaded!.url);
          setLoading(false);
        } else if (isPrevPreloaded) {
          setAudioUrl(prevPreloaded!.url);
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

        const unsubscribe = subscribeFn(audioId, (item) => {
          if (item) {
            setAudioItem(item);
            if (item.transcript) transcriptRef.current = item.transcript;
          }
        });
        unsubItemRef.current = unsubscribe;
        return;
      }

      resetPlayerState();
      setActiveAudioId(audioId);
      setLoading(true);

      const unsubscribe = subscribeFn(audioId, async (item) => {
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
    playNextRef.current = () => {
      const nextId = advanceQueue();
      if (nextId) {
        loadTrackInternal(nextId, true);
      }
    };
  }, [advanceQueue, loadTrackInternal]);

  useEffect(() => {
    return () => {
      unsubItemRef.current?.();
    };
  }, []);

  const { userQueue, autoQueue, previousTrackId } = queueManager;
  const nextQueueTrackId = userQueue[0] ?? autoQueue[0] ?? null;

  useEffect(() => {
    if (!nextQueueTrackId) return;
    if (preloadedTrackRef.current?.id === nextQueueTrackId) return;
    const item: AnyAudioItem | undefined =
      items.find((i) => i.id === nextQueueTrackId) ??
      systemItems.find((i) => i.id === nextQueueTrackId);
    if (!item?.storagePath || item.status !== 'ready') return;
    let cancelled = false;
    resolveAudioUrl(nextQueueTrackId, item.storagePath)
      .then((url) => {
        if (cancelled) return;
        const el = preloadRef.current;
        if (!el) return;
        preloadedTrackRef.current = { id: nextQueueTrackId, url };
        el.src = url;
        el.load();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nextQueueTrackId, items, systemItems, resolveAudioUrl]);

  useEffect(() => {
    if (!previousTrackId) return;
    if (prevPreloadedTrackRef.current?.id === previousTrackId) return;
    const item: AnyAudioItem | undefined =
      items.find((i) => i.id === previousTrackId) ??
      systemItems.find((i) => i.id === previousTrackId);
    if (!item?.storagePath || item.status !== 'ready') return;
    let cancelled = false;
    resolveAudioUrl(previousTrackId, item.storagePath)
      .then((url) => {
        if (cancelled) return;
        const el = prevPreloadRef.current;
        if (!el) return;
        prevPreloadedTrackRef.current = { id: previousTrackId, url };
        el.src = url;
        el.load();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [previousTrackId, items, systemItems, resolveAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const alreadyLoaded = skipLoadRef.current;
    skipLoadRef.current = false;

    if (alreadyLoaded) {
      audio.playbackRate = playbackRateRef.current;
    } else {
      audio.src = audioUrl;
      audio.playbackRate = playbackRateRef.current;
      audio.load();
    }

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

    if (alreadyLoaded && audio.readyState >= 3) {
      setDuration(audio.duration);
      syncPositionState();
      if (autoPlayRef.current) {
        audio.play().catch(() => {});
      }
    } else {
      audio.addEventListener('canplay', onCanPlay, { once: true });
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('canplay', onCanPlay);
      cancelAnimationFrame(rafRef.current);
      audio.pause();
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
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    previousTrackRef.current = previousTrack;
  }, [nextTrack, previousTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const seekBack = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      }
    };
    const seekFwd = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + 10
        );
      }
    };

    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => previousTrackRef.current());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime !== undefined) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', seekBack);
    navigator.mediaSession.setActionHandler('seekforward', seekFwd);
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

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TranscriptSegment } from '../types/audio';

interface UseTranscriptPlayerOptions {
  audioUrl: string | null;
  transcript: TranscriptSegment[];
}

interface UseTranscriptPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeSegmentIndex: number;
  activeWordIndex: number;
  playbackRate: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
}

function binarySearchSegment(
  segments: TranscriptSegment[],
  time: number
): number {
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

  if (result >= 0 && time <= segments[result].endTime) {
    return result;
  }
  return -1;
}

function findActiveWord(
  segment: TranscriptSegment,
  time: number
): number {
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

  if (result >= 0 && time <= words[result].endTime) {
    return result;
  }
  return -1;
}

export function useTranscriptPlayer({
  audioUrl,
  transcript,
}: UseTranscriptPlayerOptions): UseTranscriptPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const rafRef = useRef<number>(0);

  const updateActiveIndices = useCallback(
    (time: number) => {
      const segIdx = binarySearchSegment(transcript, time);
      setActiveSegmentIndex(segIdx);

      if (segIdx >= 0) {
        const wordIdx = findActiveWord(transcript[segIdx], time);
        setActiveWordIndex(wordIdx);
      } else {
        setActiveWordIndex(-1);
      }
    },
    [transcript]
  );

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const time = audio.currentTime;
    setCurrentTime(time);
    updateActiveIndices(time);

    rafRef.current = requestAnimationFrame(tick);
  }, [updateActiveIndices]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onSeeked = () => {
      setCurrentTime(audio.currentTime);
      updateActiveIndices(audio.currentTime);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('seeked', onSeeked);

    if (audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('seeked', onSeeked);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioUrl, tick, updateActiveIndices]);

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
    setPlaybackRateState(rate);
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
    }
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    activeWordIndex,
    playbackRate,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
  };
}

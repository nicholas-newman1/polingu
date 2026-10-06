import { startTransition, useEffect, type RefObject } from 'react';
import { emitAudioModeEvent } from '../../lib/audio/audioModeBus';
import type { TranscriptSegment } from '../../types/audio';
import { syncPositionState } from './useMediaSession';

const HIGHLIGHT_LOOKAHEAD_S = 0.5;

/** Index of the span containing `time` (spans sorted by start), or -1. */
function findActiveIndex(spans: { startTime: number; endTime: number }[], time: number): number {
  let lo = 0;
  let hi = spans.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (spans[mid].startTime <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result >= 0 && time <= spans[result].endTime ? result : -1;
}

interface PlaybackEventsOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string | null;
  /** Set when the active element was swapped in already buffered, so it must not be reloaded. */
  skipLoadRef: RefObject<boolean>;
  playbackRateRef: RefObject<number>;
  transcriptRef: RefObject<TranscriptSegment[]>;
  rafRef: RefObject<number>;
  restoreTimeRef: RefObject<number>;
  autoPlayRef: RefObject<boolean>;
  playNextRef: RefObject<(() => void) | null>;
  persistTime: (time: number) => void;
  flushTime: () => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setActiveSegmentIndex: (index: number) => void;
  setActiveWordIndex: (index: number) => void;
}

/**
 * Loads `audioUrl` into the active element and mirrors its events into player state, driving the
 * transcript highlight from a requestAnimationFrame loop while playing.
 */
export function usePlaybackEvents({
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
}: PlaybackEventsOptions) {
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
      const rate = audio?.playbackRate ?? playbackRateRef.current;
      const adjusted = time + HIGHLIGHT_LOOKAHEAD_S * rate;
      const segIdx = findActiveIndex(segments, adjusted);
      const wordIdx = segIdx >= 0 ? findActiveIndex(segments[segIdx].words, adjusted) : -1;
      return { segIdx, wordIdx };
    }

    function loop() {
      if (!audio || audio.paused) return;
      const time = audio.currentTime;
      persistTime(time);
      const { segIdx, wordIdx } = computeIndices(time);
      startTransition(() => {
        setActiveSegmentIndex(segIdx);
        setActiveWordIndex(wordIdx);
        setCurrentTime(time);
      });
      rafRef.current = requestAnimationFrame(loop);
    }

    const onPlay = () => {
      setIsPlaying(true);
      emitAudioModeEvent('audio-started');
      rafRef.current = requestAnimationFrame(loop);
      syncPositionState(audio);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      persistTime(audio.currentTime);
      flushTime();
      syncPositionState(audio);
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      flushTime();
      playNextRef.current?.();
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      if (restoreTimeRef.current > 0 && restoreTimeRef.current < audio.duration) {
        audio.currentTime = restoreTimeRef.current;
        setCurrentTime(restoreTimeRef.current);
        restoreTimeRef.current = 0;
      }
      syncPositionState(audio);
    };
    const onSeeked = () => {
      const time = audio.currentTime;
      const { segIdx, wordIdx } = computeIndices(time);
      setCurrentTime(time);
      setActiveSegmentIndex(segIdx);
      setActiveWordIndex(wordIdx);
      syncPositionState(audio);
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
      syncPositionState(audio);
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
  }, [
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
  ]);
}

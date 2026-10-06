import { useEffect, type RefObject } from 'react';

/** Saves the playback position every 30s while playing, and when the page is hidden or closed. */
export function usePersistPlaybackTime(
  audioRef: RefObject<HTMLAudioElement | null>,
  activeAudioId: string | null,
  isPlaying: boolean,
  persistTime: (time: number) => void,
  flushTime: () => void
) {
  useEffect(() => {
    if (!activeAudioId) return;

    const save = () => {
      const time = audioRef.current?.currentTime;
      if (time !== undefined) persistTime(time);
      flushTime();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const interval = isPlaying ? setInterval(save, 30000) : undefined;

    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [audioRef, activeAudioId, isPlaying, persistTime, flushTime]);
}

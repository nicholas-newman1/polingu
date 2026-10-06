import { useEffect, useRef, type RefObject } from 'react';

/** Pushes the current position to the OS media controls (lock screen, headset, etc.). */
export function syncPositionState(audio: HTMLAudioElement | null) {
  if (!('mediaSession' in navigator)) return;
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

/** Wires OS media controls to the active audio element and keeps the track title in sync. */
export function useMediaSession(
  audioRef: RefObject<HTMLAudioElement | null>,
  title: string | undefined,
  nextTrack: () => void,
  previousTrack: () => void
) {
  const nextTrackRef = useRef(nextTrack);
  const previousTrackRef = useRef(previousTrack);
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    previousTrackRef.current = previousTrack;
  }, [nextTrack, previousTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const seekBack = () => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
    };
    const seekForward = () => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
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
    navigator.mediaSession.setActionHandler('seekforward', seekForward);
  }, [audioRef]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || title === undefined) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Polingu' });
  }, [title]);
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { resolvePlayableAudioUrl } from '../lib/audio/audioPrefetchCache';

interface UseAudioPlayerOptions {
  /** The URL of the audio file to play */
  audioUrl?: string;
  /** Unique identifier for the current card (used to reset auto-play state) */
  cardId: string | number;
  /** If true, auto-play audio when component mounts */
  autoPlayOnMount?: boolean;
  /** If true, auto-play audio when revealed becomes true */
  autoPlayOnReveal?: boolean;
  /** Whether the card is revealed (for autoPlayOnReveal) */
  revealed?: boolean;
}

interface UseAudioPlayerReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start playing the audio */
  playAudio: () => void;
  /** Stop the currently playing audio */
  stopAudio: () => void;
  /** Toggle audio play/stop */
  toggleAudio: () => void;
  /** Whether an audio URL is available */
  hasAudio: boolean;
}

/**
 * Hook for managing audio playback in flashcard components.
 * Handles auto-play on mount or reveal, and respects the user's autoPlayAudio setting.
 */
export function useAudioPlayer({
  audioUrl,
  cardId,
  autoPlayOnMount = false,
  autoPlayOnReveal = false,
  revealed = false,
}: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const { settings } = useAppSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoPlayedRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  const playAudio = useCallback(() => {
    if (!audioUrl) return;

    stopAudio();

    const playableUrl = resolvePlayableAudioUrl(audioUrl) ?? audioUrl;
    const audio = new Audio(playableUrl);
    audioRef.current = audio;
    setIsPlaying(true);

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
  }, [audioUrl, stopAudio]);

  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, stopAudio, playAudio]);

  // Reset auto-play flag and stop audio when card changes
  useEffect(() => {
    hasAutoPlayedRef.current = false;
    return () => stopAudio();
  }, [cardId, stopAudio]);

  // Auto-play on mount (when card opens)
  useEffect(() => {
    if (!settings.autoPlayAudio || !audioUrl || hasAutoPlayedRef.current || !autoPlayOnMount) {
      return;
    }

    hasAutoPlayedRef.current = true;
    queueMicrotask(playAudio);
  }, [cardId, audioUrl, playAudio, autoPlayOnMount, settings.autoPlayAudio]);

  // Auto-play on reveal
  useEffect(() => {
    if (
      !settings.autoPlayAudio ||
      !audioUrl ||
      hasAutoPlayedRef.current ||
      !autoPlayOnReveal ||
      !revealed
    ) {
      return;
    }

    hasAutoPlayedRef.current = true;
    queueMicrotask(playAudio);
  }, [revealed, audioUrl, playAudio, autoPlayOnReveal, settings.autoPlayAudio]);

  return {
    isPlaying,
    playAudio,
    stopAudio,
    toggleAudio,
    hasAudio: !!audioUrl,
  };
}

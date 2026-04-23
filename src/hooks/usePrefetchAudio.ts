import { useEffect } from 'react';
import { prefetchAudio } from '../lib/audio/audioPrefetchCache';

/**
 * Prefetches one or more audio URLs into an in-memory blob cache so subsequent
 * playback starts instantly. Each unique URL is fetched at most once.
 */
export function usePrefetchAudio(audioUrls: Array<string | null | undefined>): void {
  const key = audioUrls.filter((url): url is string => !!url).join('\u0001');

  useEffect(() => {
    if (!key) return;
    for (const url of key.split('\u0001')) {
      prefetchAudio(url);
    }
  }, [key]);
}

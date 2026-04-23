/**
 * In-memory LRU cache of prefetched audio blobs.
 *
 * Storing a Blob + object URL lets playback start instantly — browsers do not
 * reliably share `HTMLMediaElement` fetches with the HTTP cache, so
 * `preload="auto"` alone is often not enough on slower networks.
 *
 * If `fetch()` fails (typically because the response lacks CORS headers), we
 * fall back to creating a hidden `<audio preload="auto">` element, which
 * loads cross-origin media without CORS but only warms the browser's media
 * cache rather than giving us a blob we can play instantly.
 */

interface CacheEntry {
  objectUrl: string;
  blob: Blob;
}

const MAX_ENTRIES = 20;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<void>>();
const fallbackWarmed = new Set<string>();
const fallbackElements = new Set<HTMLAudioElement>();

function touch(url: string): void {
  const entry = cache.get(url);
  if (!entry) return;
  cache.delete(url);
  cache.set(url, entry);
}

function evictIfNeeded(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    const entry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (entry) URL.revokeObjectURL(entry.objectUrl);
  }
}

function warmViaAudioElement(url: string): void {
  if (fallbackWarmed.has(url)) return;
  fallbackWarmed.add(url);
  try {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
    fallbackElements.add(audio);
    const done = () => {
      audio.removeEventListener('canplaythrough', done);
      audio.removeEventListener('error', done);
      fallbackElements.delete(audio);
    };
    audio.addEventListener('canplaythrough', done);
    audio.addEventListener('error', done);
  } catch {
    // Swallow — prefetch is best-effort.
  }
}

/**
 * Start fetching an audio URL into the in-memory cache. Safe to call many
 * times with the same URL — already-cached or in-flight URLs are no-ops.
 */
export function prefetchAudio(url: string | null | undefined): void {
  if (!url) return;
  if (cache.has(url)) {
    touch(url);
    return;
  }
  if (inFlight.has(url)) return;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        warmViaAudioElement(url);
        return;
      }
      const blob = await response.blob();
      if (cache.has(url)) return;
      const objectUrl = URL.createObjectURL(blob);
      cache.set(url, { objectUrl, blob });
      evictIfNeeded();
    } catch {
      warmViaAudioElement(url);
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, promise);
}

/**
 * Return the object URL for a cached audio file, or the original URL if not
 * cached. Marks the entry as most-recently-used on hit.
 */
export function resolvePlayableAudioUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const entry = cache.get(url);
  if (entry) {
    touch(url);
    return entry.objectUrl;
  }
  return url;
}

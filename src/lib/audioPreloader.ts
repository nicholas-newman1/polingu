/**
 * Audio preloader for downloading audio files for offline use.
 * Uses the Service Worker Cache API to store audio files.
 */

const AUDIO_CACHE_NAME = 'polingu-audio';

export interface PreloadProgress {
  loaded: number;
  total: number;
  currentUrl?: string;
  failed: number;
}

/**
 * Preload audio files into the Service Worker cache for offline use.
 * @param items - Array of items with optional audioUrl property
 * @param onProgress - Callback for progress updates
 * @returns Number of successfully cached files
 */
export async function preloadAudioFiles(
  items: Array<{ audioUrl?: string }>,
  onProgress?: (progress: PreloadProgress) => void
): Promise<number> {
  const urls = items
    .map((item) => item.audioUrl)
    .filter((url): url is string => !!url && url.length > 0);

  if (urls.length === 0) {
    return 0;
  }

  const cache = await caches.open(AUDIO_CACHE_NAME);
  let loaded = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      // Check if already cached
      const cached = await cache.match(url);
      if (!cached) {
        await cache.add(url);
      }
      loaded++;
    } catch (e) {
      console.warn(`Failed to cache audio: ${url}`, e);
      failed++;
    }

    onProgress?.({
      loaded,
      total: urls.length,
      currentUrl: url,
      failed,
    });
  }

  return loaded;
}

/**
 * Get the number of audio files currently in the cache
 */
export async function getAudioCacheCount(): Promise<number> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Get the total size in bytes of the audio files currently in the cache
 */
export async function getAudioCacheSize(): Promise<number> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    let total = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (!response) continue;
      // The header avoids reading the body; fall back to it when the header is missing.
      const length = Number(response.headers.get('content-length'));
      total += length > 0 ? length : (await response.blob()).size;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Clear all cached audio files
 */
export async function clearAudioCache(): Promise<void> {
  try {
    await caches.delete(AUDIO_CACHE_NAME);
  } catch (e) {
    console.error('Failed to clear audio cache:', e);
  }
}

/**
 * Format bytes to human readable string
 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

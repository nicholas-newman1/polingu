import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { cacheAudioBlob, getAudioDownloadUrl, getCachedAudioBlob } from '../../lib/audio';

const MAX_BLOB_URL_ENTRIES = 20;

/**
 * Resolves a playable URL for a track: an in-memory blob URL, then an IndexedDB-cached blob,
 * then a signed download URL (whose blob is cached in the background for next time).
 * Blob URLs are LRU-evicted, except the one currently playing (`activeUrlRef`).
 */
export function useAudioUrlResolver(activeUrlRef: RefObject<string | null>) {
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());

  const rememberBlobUrl = useCallback(
    (audioId: string, url: string) => {
      const cache = blobUrlCacheRef.current;
      cache.delete(audioId);
      cache.set(audioId, url);
      while (cache.size > MAX_BLOB_URL_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) return;
        const oldUrl = cache.get(oldestKey);
        cache.delete(oldestKey);
        if (oldUrl && oldUrl !== activeUrlRef.current) URL.revokeObjectURL(oldUrl);
      }
    },
    [activeUrlRef]
  );

  useEffect(() => {
    const cache = blobUrlCacheRef.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  return useCallback(
    async (audioId: string, storagePath: string): Promise<string> => {
      const existingBlobUrl = blobUrlCacheRef.current.get(audioId);
      if (existingBlobUrl) {
        rememberBlobUrl(audioId, existingBlobUrl);
        return existingBlobUrl;
      }

      const cachedBlob = await getCachedAudioBlob(audioId);
      if (cachedBlob) {
        const blobUrl = URL.createObjectURL(cachedBlob);
        rememberBlobUrl(audioId, blobUrl);
        return blobUrl;
      }

      const signedUrl =
        signedUrlCacheRef.current.get(storagePath) ?? (await getAudioDownloadUrl(storagePath));
      signedUrlCacheRef.current.set(storagePath, signedUrl);

      fetch(signedUrl)
        .then((res) => res.blob())
        .then((blob) => cacheAudioBlob(audioId, blob))
        .catch(() => {});

      return signedUrl;
    },
    [rememberBlobUrl]
  );
}

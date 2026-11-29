import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { cacheAudioBlob, getAudioDownloadUrl, getCachedAudioBlob } from '../../lib/audio';
import { createObjectUrlLru } from '../../lib/audio/objectUrlLru';

const MAX_BLOB_URL_ENTRIES = 20;

/**
 * Resolves a playable URL for a track: an in-memory blob URL, then an IndexedDB-cached blob,
 * then a signed download URL (whose blob is cached in the background for next time).
 * Blob URLs are LRU-evicted, except the one currently playing (`activeUrlRef`).
 */
export function useAudioUrlResolver(activeUrlRef: RefObject<string | null>) {
  const [blobUrls] = useState(() => createObjectUrlLru(MAX_BLOB_URL_ENTRIES));
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => () => blobUrls.clear(), [blobUrls]);

  return useCallback(
    async (audioId: string, storagePath: string): Promise<string> => {
      const existingBlobUrl = blobUrls.get(audioId);
      if (existingBlobUrl) return existingBlobUrl;

      const cachedBlob = await getCachedAudioBlob(audioId);
      if (cachedBlob) {
        const blobUrl = URL.createObjectURL(cachedBlob);
        blobUrls.set(audioId, blobUrl, activeUrlRef.current);
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
    [blobUrls, activeUrlRef]
  );
}

/**
 * Direct access to the app's IndexedDB audio blob cache (src/lib/audio/audioCache.ts),
 * through a connection of its own, for resetting it between tests.
 */
const DB_NAME = 'polingu-audio-cache';
const STORE_NAME = 'audio-blobs';

/** Empties the audio blob cache, creating it first if no test has opened it yet. */
export async function clearAudioBlobStore() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Stand-in for `firebase/storage`. Download URLs are `https://storage.test/<path>`.
 *
 *   vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
 *
 * Set `storageServer.offline = true` to make every download URL request fail.
 * Uploads wait in `storageServer.uploads` for the test to report progress,
 * fail them, or complete them.
 */

export const STORAGE_ORIGIN = 'https://storage.test/';

interface UploadObserver {
  next?: (snapshot: { bytesTransferred: number; totalBytes: number }) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface FakeUpload {
  path: string;
  file: unknown;
  progress: (bytesTransferred: number, totalBytes: number) => void;
  fail: (message: string) => void;
  complete: () => void;
}

export const storageServer = {
  offline: false,
  /** Every path a download URL was requested for, in order. */
  requested: [] as string[],
  uploads: [] as FakeUpload[],
  reset() {
    this.offline = false;
    this.requested.length = 0;
    this.uploads.length = 0;
  },
};

export interface StorageReference {
  fullPath: string;
}

export function ref(_storage: unknown, path: string): StorageReference {
  return { fullPath: path };
}

export async function getDownloadURL(reference: StorageReference): Promise<string> {
  await Promise.resolve();
  storageServer.requested.push(reference.fullPath);
  if (storageServer.offline) throw new Error('storage/retry-limit-exceeded');
  return STORAGE_ORIGIN + reference.fullPath;
}

export function uploadBytesResumable(reference: StorageReference, file: unknown) {
  const observers: UploadObserver[] = [];
  storageServer.uploads.push({
    path: reference.fullPath,
    file,
    progress: (bytesTransferred, totalBytes) =>
      observers.forEach((o) => o.next?.({ bytesTransferred, totalBytes })),
    fail: (message) => observers.forEach((o) => o.error?.(new Error(message))),
    complete: () => observers.forEach((o) => o.complete?.()),
  });
  return {
    on(
      _event: 'state_changed',
      next?: UploadObserver['next'],
      error?: UploadObserver['error'],
      complete?: UploadObserver['complete']
    ) {
      observers.push({ next, error, complete });
      return () => {};
    },
  };
}

export const getStorage = () => ({});

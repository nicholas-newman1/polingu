/**
 * In-memory stand-in for the parts of `firebase/storage` the audio and reader
 * libraries use. Install it with
 *
 *   vi.mock('firebase/storage', () => import('./support/fakeStorage'));
 *
 * and drive it through `bucket`:
 *   - `bucket.uploads` lists every upload started, newest last. Each one is driven by
 *     the test: `progress(bytes)`, `fail(error)`, `finish()`.
 *   - `bucket.files` holds the paths that exist; `getDownloadURL` rejects for others.
 */

export interface StorageReference {
  readonly fullPath: string;
}

export interface UploadMetadata {
  customMetadata?: Record<string, string>;
}

interface TaskSnapshot {
  bytesTransferred: number;
  totalBytes: number;
}

interface Observer {
  next: (snapshot: TaskSnapshot) => void;
  error: (error: Error) => void;
  complete: () => void;
}

export class StorageError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FirebaseError';
  }
}

export class FakeUploadTask {
  readonly path: string;
  readonly data: Blob;
  readonly metadata: UploadMetadata | undefined;
  private observer: Observer | null = null;

  constructor(path: string, data: Blob, metadata: UploadMetadata | undefined) {
    this.path = path;
    this.data = data;
    this.metadata = metadata;
  }

  on(
    _event: 'state_changed',
    next: Observer['next'],
    error: Observer['error'],
    complete: Observer['complete']
  ): () => void {
    this.observer = { next, error, complete };
    return () => {
      this.observer = null;
    };
  }

  /** Report that `bytes` of the file have been sent. */
  progress(bytes: number) {
    this.observer?.next({ bytesTransferred: bytes, totalBytes: this.data.size });
  }

  fail(error: Error = new StorageError('storage/unauthorized', 'User does not have permission.')) {
    this.observer?.error(error);
  }

  /** Finish the upload: the file now exists in the bucket. */
  finish() {
    bucket.files.add(this.path);
    this.observer?.complete();
  }
}

class FakeBucket {
  readonly uploads: FakeUploadTask[] = [];
  readonly files = new Set<string>();

  reset() {
    this.uploads.length = 0;
    this.files.clear();
  }

  /** The only upload started so far; fails the test if there is not exactly one. */
  get onlyUpload(): FakeUploadTask {
    if (this.uploads.length !== 1) {
      throw new Error(`Expected exactly one upload, found ${this.uploads.length}`);
    }
    return this.uploads[0];
  }
}

export const bucket = new FakeBucket();

/** The download URL `getDownloadURL` returns for a stored path. */
export const downloadUrlFor = (path: string) =>
  `https://files.test/o/${encodeURIComponent(path)}?token=t`;

export function ref(_storage: unknown, path: string): StorageReference {
  return { fullPath: path };
}

export function uploadBytesResumable(
  storageRef: StorageReference,
  data: Blob,
  metadata?: UploadMetadata
): FakeUploadTask {
  const task = new FakeUploadTask(storageRef.fullPath, data, metadata);
  bucket.uploads.push(task);
  return task;
}

export async function getDownloadURL(storageRef: StorageReference): Promise<string> {
  await Promise.resolve();
  if (!bucket.files.has(storageRef.fullPath)) {
    throw new StorageError(
      'storage/object-not-found',
      `Object '${storageRef.fullPath}' does not exist.`
    );
  }
  return downloadUrlFor(storageRef.fullPath);
}

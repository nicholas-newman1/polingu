/**
 * Stand-in for `firebase/storage`. Uploads are held until the test drives them:
 *
 *   const upload = uploads.latest();
 *   upload.progress(0.5);   // half the bytes sent
 *   upload.complete();      // or upload.fail(new Error('...'))
 *
 *   vi.mock('firebase/storage', () => import('./support/storage'));
 */
interface StorageRef {
  fullPath: string;
}

type Next = (snapshot: { bytesTransferred: number; totalBytes: number }) => void;
type Fail = (error: Error) => void;
type Done = () => void;

export class FakeUploadTask {
  readonly path: string;
  readonly file: Blob & { name?: string };
  readonly metadata: { customMetadata?: Record<string, string> } | undefined;
  private listeners: { next?: Next; error?: Fail; complete?: Done } = {};

  constructor(path: string, file: Blob, metadata?: { customMetadata?: Record<string, string> }) {
    this.path = path;
    this.file = file;
    this.metadata = metadata;
  }

  on(_event: string, next?: Next, error?: Fail, complete?: Done) {
    this.listeners = { next, error, complete };
    return () => {};
  }

  /** Report `fraction` (0..1) of the file as sent. */
  progress(fraction: number) {
    const totalBytes = Math.max(1, this.file.size);
    this.listeners.next?.({ bytesTransferred: fraction * totalBytes, totalBytes });
  }

  fail(error: Error) {
    this.listeners.error?.(error);
  }

  complete() {
    this.listeners.complete?.();
  }

  /** The id the app chose for this upload: `.../pending/{id}/{fileName}`. */
  get id(): string {
    const parts = this.path.split('/');
    return parts[parts.length - 2];
  }
}

class Uploads {
  readonly tasks: FakeUploadTask[] = [];
  downloadFails = false;

  latest(): FakeUploadTask {
    const task = this.tasks.at(-1);
    if (!task) throw new Error('No upload has started');
    return task;
  }

  reset() {
    this.tasks.length = 0;
    this.downloadFails = false;
  }
}

export const uploads = new Uploads();

export function getStorage() {
  return { __fake: 'storage' };
}

export function ref(_storage: unknown, path: string): StorageRef {
  return { fullPath: path };
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  if (uploads.downloadFails) throw new Error('storage/unauthorized');
  return `https://storage.test/${storageRef.fullPath}`;
}

export function uploadBytesResumable(
  storageRef: StorageRef,
  file: Blob,
  metadata?: { customMetadata?: Record<string, string> }
) {
  const task = new FakeUploadTask(storageRef.fullPath, file, metadata);
  uploads.tasks.push(task);
  return task;
}

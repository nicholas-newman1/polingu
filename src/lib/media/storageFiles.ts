import { doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { FirestorePath } from './cachedCollection';

export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

export interface UploadProgress {
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadPercent?: number;
  error?: string;
}

interface PendingUploadOptions {
  file: File;
  /** Storage folder the server processes uploads from; the file goes in a subfolder named by its id. */
  pendingFolder: string;
  /** Collection the server writes the processed item to, under the same id. */
  itemCollection: FirestorePath;
  customMetadata?: Record<string, string>;
  /** How long to wait for the server to finish before giving up. */
  timeoutMs: number;
  onProgress: (progress: UploadProgress) => void;
  /** Called once the file is uploaded, before the server has processed it. */
  onUploaded?: (id: string) => void;
}

/**
 * Uploads a file under a fresh id for the server to process, then waits until the server marks
 * the item it creates ready (resolving with the id) or failed.
 */
export function uploadPendingAndAwait({
  file,
  pendingFolder,
  itemCollection,
  customMetadata,
  timeoutMs,
  onProgress,
  onUploaded,
}: PendingUploadOptions): Promise<string> {
  const id = crypto.randomUUID();
  const uploadTask = uploadBytesResumable(
    ref(storage, `${pendingFolder}/${id}/${file.name}`),
    file,
    customMetadata ? { customMetadata } : undefined
  );

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress({ status: 'uploading', uploadPercent: percent });
      },
      (error) => {
        onProgress({ status: 'error', error: error.message });
        reject(error);
      },
      () => {
        onProgress({ status: 'processing' });
        onUploaded?.(id);

        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Processing timed out. Please try again.'));
        }, timeoutMs);

        const unsubscribe = onSnapshot(doc(db, ...itemCollection, id), (snapshot) => {
          if (!snapshot.exists()) return;
          const { status, error } = snapshot.data() as { status: string; error?: string };
          if (status !== 'ready' && status !== 'error') return;

          clearTimeout(timeout);
          unsubscribe();
          if (status === 'ready') {
            onProgress({ status: 'ready' });
            resolve(id);
          } else {
            onProgress({ status: 'error', error });
            reject(new Error(error || 'Processing failed.'));
          }
        });
      }
    );
  });
}

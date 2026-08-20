import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { getUserId } from '../storage/helpers';
import type { UploadProgress, Book } from '../../types/reader';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const PROCESSING_TIMEOUT = 5 * 60 * 1000;

function waitForBookProcessing(
  userId: string,
  bookId: string,
  onProgress: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onProgress({ status: 'processing', bookId });

    const bookRef = doc(db, 'users', userId, 'books', bookId);

    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Processing timed out. Please try again.'));
    }, PROCESSING_TIMEOUT);

    const finish = (onDone: () => void) => {
      clearTimeout(timeout);
      unsubscribe();
      onDone();
    };

    const unsubscribe = onSnapshot(bookRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() as Book;

      if (data.status === 'ready') {
        finish(() => {
          onProgress({ status: 'ready', bookId });
          resolve();
        });
      } else if (data.status === 'error') {
        finish(() => {
          onProgress({ status: 'error', error: data.error, bookId });
          reject(new Error(data.error || 'Processing failed.'));
        });
      }
    });
  });
}

async function uploadFileToPending(
  file: File,
  onProgress: (progress: UploadProgress) => void,
  customMetadata?: Record<string, string>
): Promise<string> {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 50MB.');
  }

  const bookId = crypto.randomUUID();
  const storagePath = `books/users/${userId}/pending/${bookId}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(
    storageRef,
    file,
    customMetadata ? { customMetadata } : undefined
  );

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress({ status: 'uploading', uploadPercent: percent, bookId });
      },
      (error) => {
        onProgress({ status: 'error', error: error.message, bookId });
        reject(error);
      },
      async () => {
        try {
          await waitForBookProcessing(userId, bookId, onProgress);
          resolve(bookId);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

export async function uploadBook(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Only PDF files are supported.');
  }

  return uploadFileToPending(file, onProgress);
}

export interface UploadTextParams {
  content: string;
  title?: string;
  author?: string;
}

export async function uploadText(
  params: UploadTextParams,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  const trimmed = params.content.trim();
  if (!trimmed) {
    throw new Error('Text cannot be empty.');
  }

  const title = params.title?.trim();
  const author = params.author?.trim();

  const blob = new Blob([trimmed], { type: 'text/plain;charset=utf-8' });
  const file = new File([blob], 'book.txt', { type: 'text/plain' });

  return uploadFileToPending(file, onProgress, {
    ...(title && { bookTitle: title }),
    ...(author && { bookAuthor: author }),
  });
}

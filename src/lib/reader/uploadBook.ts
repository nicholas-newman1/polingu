import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { getUserId } from '../storage/helpers';
import type { UploadProgress, Book } from '../../types/reader';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function uploadBook(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 50MB.');
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Only PDF files are supported.');
  }

  const bookId = crypto.randomUUID();
  const storagePath = `books/users/${userId}/pending/${bookId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

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
      () => {
        onProgress({ status: 'processing', bookId });

        const bookRef = doc(db, 'users', userId, 'books', bookId);
        const unsubscribe = onSnapshot(bookRef, (snapshot) => {
          if (!snapshot.exists()) return;

          const data = snapshot.data() as Book;

          if (data.status === 'ready') {
            unsubscribe();
            onProgress({ status: 'ready', bookId });
            resolve(bookId);
          } else if (data.status === 'error') {
            unsubscribe();
            onProgress({ status: 'error', error: data.error, bookId });
            reject(new Error(data.error));
          }
        });

        setTimeout(
          () => {
            unsubscribe();
            reject(new Error('Processing timed out. Please try again.'));
          },
          5 * 60 * 1000
        );
      }
    );
  });
}

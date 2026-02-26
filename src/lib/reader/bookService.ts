import { collection, doc, getDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { saveUserData, loadUserData } from '../offlineDb/userSync';
import { getUserId } from '../storage/helpers';
import type { Book, ReadingProgress } from '../../types/reader';

export async function getBooks(): Promise<Book[]> {
  const userId = getUserId();
  if (!userId) return [];

  const booksRef = collection(db, 'users', userId, 'books');
  const q = query(booksRef, orderBy('uploadedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as Book);
}

export function subscribeToBooksUpdates(callback: (books: Book[]) => void): () => void {
  const userId = getUserId();
  if (!userId) return () => {};

  const booksRef = collection(db, 'users', userId, 'books');
  const q = query(booksRef, orderBy('uploadedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map((doc) => doc.data() as Book);
    callback(books);
  });
}

export async function getBook(bookId: string): Promise<Book | null> {
  const userId = getUserId();
  if (!userId) return null;

  const bookRef = doc(db, 'users', userId, 'books', bookId);
  const bookDoc = await getDoc(bookRef);

  if (!bookDoc.exists()) return null;
  return bookDoc.data() as Book;
}

export async function getBookDownloadUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
}

export async function getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  return loadUserData<ReadingProgress>(`reader-progress-${bookId}`);
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<void> {
  await saveUserData(`reader-progress-${progress.bookId}`, progress);
}

interface DeleteBookRequest {
  bookId: string;
}

export async function deleteBook(bookId: string): Promise<void> {
  const deleteFn = httpsCallable<DeleteBookRequest, { success: boolean }>(functions, 'deleteBook');
  await deleteFn({ bookId });
}

interface UpdateBookRequest {
  bookId: string;
  title?: string;
  author?: string;
}

export async function updateBook(
  bookId: string,
  updates: { title?: string; author?: string }
): Promise<void> {
  const updateBookFn = httpsCallable<UpdateBookRequest, { success: boolean }>(
    functions,
    'renameBook'
  );
  await updateBookFn({ bookId, ...updates });
}

export async function getStorageUsage(): Promise<{ usedBytes: number; maxBytes: number }> {
  const getUsageFn = httpsCallable<void, { usedBytes: number; maxBytes: number }>(
    functions,
    'getStorageUsage'
  );
  const result = await getUsageFn();
  return result.data;
}

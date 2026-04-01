import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { saveUserData } from '../offlineDb/userSync';
import { loadUserData } from '../offlineDb/userDataWrapper';
import { userDb } from '../offlineDb/userDb';
import { getUserId } from '../storage/helpers';
import type { Book, BookColor, ReadingProgress } from '../../types/reader';

const BOOKS_CACHE_KEY = '__books-list';

export async function getCachedBooks(): Promise<Book[]> {
  const record = await userDb.userData.get(BOOKS_CACHE_KEY);
  return record ? (record.data as Book[]) : [];
}

async function cacheBooks(books: Book[]): Promise<void> {
  await userDb.userData.put({
    key: BOOKS_CACHE_KEY,
    data: books,
    lastModified: Date.now(),
    pendingSync: 0,
  });
}

export async function getBooks(): Promise<Book[]> {
  const userId = getUserId();
  if (!userId) return [];

  const cached = await getCachedBooks();

  if (!navigator.onLine) return cached;

  try {
    const booksRef = collection(db, 'users', userId, 'books');
    const q = query(booksRef, orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);
    const books = snapshot.docs.map((d) => d.data() as Book);
    await cacheBooks(books);
    return books;
  } catch (e) {
    console.error('Failed to fetch books from Firestore:', e);
    return cached;
  }
}

export function subscribeToBooksUpdates(callback: (books: Book[]) => void): () => void {
  const userId = getUserId();
  if (!userId) return () => {};

  const booksRef = collection(db, 'users', userId, 'books');
  const q = query(booksRef, orderBy('uploadedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const books = snapshot.docs.map((d) => d.data() as Book);
      cacheBooks(books);
      callback(books);
    },
    (error) => {
      console.error('Books subscription error:', error);
    }
  );
}

export async function getBook(bookId: string): Promise<Book | null> {
  const userId = getUserId();
  if (!userId) return null;

  if (!navigator.onLine) {
    const cached = await getCachedBooks();
    return cached.find((b) => b.id === bookId) ?? null;
  }

  try {
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    const bookDoc = await getDoc(bookRef);
    if (!bookDoc.exists()) return null;
    return bookDoc.data() as Book;
  } catch (e) {
    console.error('Failed to fetch book from Firestore:', e);
    const cached = await getCachedBooks();
    return cached.find((b) => b.id === bookId) ?? null;
  }
}

export async function getBookDownloadUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
}

export async function getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  const progress = await loadUserData<ReadingProgress | null>(`reader-progress-${bookId}`, null);
  return progress;
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

export async function updateBook(
  bookId: string,
  updates: { title?: string; author?: string; color?: BookColor }
): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  const bookRef = doc(db, 'users', userId, 'books', bookId);

  const cleanUpdates: Record<string, string | undefined> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  if (updates.author !== undefined) cleanUpdates.author = updates.author.trim() || undefined;
  if (updates.color !== undefined) cleanUpdates.color = updates.color;

  await updateDoc(bookRef, cleanUpdates);
}

export async function getStorageUsage(): Promise<{ usedBytes: number; maxBytes: number }> {
  const getUsageFn = httpsCallable<void, { usedBytes: number; maxBytes: number }>(
    functions,
    'getStorageUsage'
  );
  const result = await getUsageFn();
  return result.data;
}

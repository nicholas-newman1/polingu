import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { cachedCollection } from '../media/cachedCollection';
import { getStorageDownloadUrl } from '../media/storageFiles';
import { loadUserData, saveUserData } from '../offlineDb/userDataWrapper';
import { userDb } from '../offlineDb/userDb';
import { getCurrentUserId } from '../cachedAuth';
import { undefinedToDeleteField } from '../storage/firestoreUtils';
import type { Book, BookColor, ReadingProgress } from '../../types/reader';

const BOOK_TEXT_CACHE_PREFIX = '__book-text-';

const books = cachedCollection<Book>({
  cacheKey: '__books-list',
  path: () => {
    const userId = getCurrentUserId();
    return userId ? ['users', userId, 'books'] : null;
  },
  newestFirstBy: 'uploadedAt',
  label: 'Books',
});

export const getCachedBooks = books.getCached;
export const subscribeToBooksUpdates = books.subscribe;

export async function getBook(bookId: string): Promise<Book | null> {
  const userId = getCurrentUserId();
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

export const getBookDownloadUrl = getStorageDownloadUrl;

/** A book's text was never downloaded, so it can't be read until the device is back online. */
export class BookTextOfflineError extends Error {
  constructor() {
    super('Text not available offline. Open this book once while online.');
    this.name = 'BookTextOfflineError';
  }
}

export async function getBookTextContent(bookId: string, storagePath: string): Promise<string> {
  const cacheKey = `${BOOK_TEXT_CACHE_PREFIX}${bookId}`;
  const cached = await userDb.userData.get(cacheKey);
  if (cached) {
    return cached.data as string;
  }

  if (!navigator.onLine) {
    throw new BookTextOfflineError();
  }

  const url = await getBookDownloadUrl(storagePath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load text content.');
  }

  const text = await response.text();
  await userDb.userData.put({
    key: cacheKey,
    data: text,
    lastModified: Date.now(),
    pendingSync: 0,
  });

  return text;
}

async function clearBookTextCache(bookId: string): Promise<void> {
  await userDb.userData.delete(`${BOOK_TEXT_CACHE_PREFIX}${bookId}`);
}

export async function getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  const progress = await loadUserData<ReadingProgress | null>(`reader-progress-${bookId}`, null);
  return progress;
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<void> {
  // Callers fire-and-forget; a failed Firestore write stays pendingSync and is retried later.
  await saveUserData(`reader-progress-${progress.bookId}`, progress).catch(() => {});
}

interface DeleteBookRequest {
  bookId: string;
}

export async function deleteBook(bookId: string): Promise<void> {
  const deleteFn = httpsCallable<DeleteBookRequest, { success: boolean }>(functions, 'deleteBook');
  await deleteFn({ bookId });
  await clearBookTextCache(bookId);
}

export async function updateBook(
  bookId: string,
  updates: { title?: string; author?: string; color?: BookColor }
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  const bookRef = doc(db, 'users', userId, 'books', bookId);

  const cleanUpdates: Record<string, string | undefined> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  if (updates.author !== undefined) cleanUpdates.author = updates.author.trim() || undefined;
  if (updates.color !== undefined) cleanUpdates.color = updates.color;

  await updateDoc(bookRef, undefinedToDeleteField(cleanUpdates));
}

export async function getStorageUsage(): Promise<{ usedBytes: number; maxBytes: number }> {
  const getUsageFn = httpsCallable<void, { usedBytes: number; maxBytes: number }>(
    functions,
    'getStorageUsage'
  );
  const result = await getUsageFn();
  return result.data;
}

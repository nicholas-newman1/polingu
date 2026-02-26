import { onObjectFinalized } from 'firebase-functions/storage';
import { onCall, HttpsError } from 'firebase-functions/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const db = getFirestore();
const storage = getStorage();

const DEFAULT_BUCKET = 'polish-declension.firebasestorage.app';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_USER_STORAGE = 1024 * 1024 * 1024;

interface BookMetadata {
  id: string;
  userId: string;
  title: string;
  author?: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf';
  storagePath: string;
  uploadedAt: number;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  pageCount?: number;
}

interface ExtractedPdfMetadata {
  title: string;
  author?: string;
  pageCount: number;
}

async function extractPdfMetadata(buffer: Buffer): Promise<ExtractedPdfMetadata> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let title = 'Untitled';
  let author: string | undefined;

  try {
    const metadata = await pdf.getMetadata();
    if (metadata?.info) {
      const info = metadata.info as Record<string, unknown>;
      if (typeof info.Title === 'string' && info.Title.trim()) {
        title = info.Title.trim();
      }
      if (typeof info.Author === 'string' && info.Author.trim()) {
        author = info.Author.trim();
      }
    }
  } catch {
    // Metadata extraction failed, use defaults
  }

  return {
    title,
    author,
    pageCount: pdf.numPages,
  };
}

async function getUserStorageUsage(userId: string): Promise<number> {
  const booksSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('books')
    .where('status', '==', 'ready')
    .get();

  let totalSize = 0;
  booksSnapshot.forEach((doc) => {
    const book = doc.data() as BookMetadata;
    totalSize += book.fileSize || 0;
  });

  return totalSize;
}

export const processBookUpload = onObjectFinalized(
  {
    bucket: DEFAULT_BUCKET,
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const fileSize =
      typeof event.data.size === 'string' ? parseInt(event.data.size, 10) : event.data.size;

    const pathMatch = filePath.match(/^books\/users\/([^/]+)\/pending\/([^/]+)\/(.+)$/);
    if (!pathMatch) return;

    const [, userId, bookId, fileName] = pathMatch;
    const bookRef = db.collection('users').doc(userId).collection('books').doc(bookId);

    try {
      const isPdf = contentType === 'application/pdf' || fileName.endsWith('.pdf');

      if (!isPdf) {
        throw new Error('Invalid file type. Only PDF files are supported.');
      }

      if (fileSize > MAX_FILE_SIZE) {
        throw new Error('File too large. Maximum size is 50MB.');
      }

      const currentUsage = await getUserStorageUsage(userId);
      if (currentUsage + fileSize > MAX_USER_STORAGE) {
        throw new Error('Storage quota exceeded. Maximum is 1GB.');
      }

      const bucket = storage.bucket(event.data.bucket);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();

      const finalPath = `books/users/${userId}/${bookId}/${fileName}`;
      await file.move(finalPath);

      const extracted = await extractPdfMetadata(buffer);

      const bookData: BookMetadata = {
        id: bookId,
        userId,
        title: extracted.title || fileName.replace(/\.pdf$/i, ''),
        author: extracted.author,
        fileName,
        fileSize,
        fileType: 'pdf',
        storagePath: finalPath,
        uploadedAt: Date.now(),
        status: 'ready',
        pageCount: extracted.pageCount,
      };

      await bookRef.set(bookData);

      await db
        .collection('users')
        .doc(userId)
        .collection('data')
        .doc(`reader-progress-${bookId}`)
        .set({
          bookId,
          currentPage: 1,
          scrollPercent: 0,
          lastReadAt: Date.now(),
        });

      console.log(`Successfully processed book ${bookId} for user ${userId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`Failed to process book ${bookId}:`, error);

      await bookRef.set({
        id: bookId,
        userId,
        fileName,
        fileSize,
        status: 'error',
        error: errorMessage,
        uploadedAt: Date.now(),
      });

      try {
        const bucket = storage.bucket(event.data.bucket);
        await bucket.file(filePath).delete();
      } catch {
        // Ignore deletion errors
      }
    }
  }
);

interface UpdateBookRequest {
  bookId: string;
  title?: string;
  author?: string;
}

export const renameBook = onCall<UpdateBookRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { bookId, title, author } = request.data;

    if (!bookId) {
      throw new HttpsError('invalid-argument', 'Book ID required.');
    }

    const bookRef = db.collection('users').doc(userId).collection('books').doc(bookId);
    const bookDoc = await bookRef.get();

    if (!bookDoc.exists) {
      throw new HttpsError('not-found', 'Book not found.');
    }

    const book = bookDoc.data() as BookMetadata;

    if (book.userId !== userId) {
      throw new HttpsError('permission-denied', 'Not your book.');
    }

    const updates: Partial<BookMetadata> = {};
    if (title !== undefined) updates.title = title.trim();
    if (author !== undefined) updates.author = author.trim() || undefined;

    if (Object.keys(updates).length > 0) {
      await bookRef.update(updates);
    }

    return { success: true };
  }
);

interface DeleteBookRequest {
  bookId: string;
}

export const deleteBook = onCall<DeleteBookRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { bookId } = request.data;

    if (!bookId) {
      throw new HttpsError('invalid-argument', 'Book ID required.');
    }

    const bookRef = db.collection('users').doc(userId).collection('books').doc(bookId);
    const bookDoc = await bookRef.get();

    if (!bookDoc.exists) {
      throw new HttpsError('not-found', 'Book not found.');
    }

    const book = bookDoc.data() as BookMetadata;

    if (book.userId !== userId) {
      throw new HttpsError('permission-denied', 'Not your book.');
    }

    if (book.storagePath) {
      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(book.storagePath).delete();
      } catch {
        // File might not exist
      }
    }

    const batch = db.batch();

    batch.delete(
      db.collection('users').doc(userId).collection('data').doc(`reader-progress-${bookId}`)
    );

    batch.delete(bookRef);

    await batch.commit();

    return { success: true };
  }
);

export const getStorageUsage = onCall<void, Promise<{ usedBytes: number; maxBytes: number }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const usedBytes = await getUserStorageUsage(userId);

    return {
      usedBytes,
      maxBytes: MAX_USER_STORAGE,
    };
  }
);

import { onObjectFinalized } from 'firebase-functions/storage';
import { DEFAULT_BUCKET } from '../../shared/config.js';
import { parsePendingUpload } from '../../shared/pendingUpload.js';
import { db, storage } from '../../shared/firebase.js';
import { isKilled } from '../../shared/killSwitch.js';
import { isAdmin } from '../../shared/auth.js';
import {
  BookMetadata,
  MAX_FILE_SIZE_BOOKS,
  MAX_USER_STORAGE,
  extractPdfMetadata,
  extractTextMetadata,
  getUnusedColor,
} from '../../shared/books.js';

function getCustomMetadataValue(
  metadata: Record<string, string> | undefined,
  key: string
): string | undefined {
  if (!metadata) return undefined;

  const lowerKey = key.toLowerCase();
  const value = metadata[lowerKey] ?? metadata[key];
  const trimmed = value?.trim();
  return trimmed || undefined;
}

type BookBase = Omit<BookMetadata, 'title' | 'author' | 'fileType'>;
type ProvidedMetadata = { title?: string; author?: string };

async function buildPdfBook(
  base: BookBase,
  provided: ProvidedMetadata,
  buffer: Buffer
): Promise<BookMetadata> {
  const extracted = await extractPdfMetadata(buffer);
  const author = provided.author || extracted.author;
  return {
    ...base,
    title: provided.title || extracted.title || base.fileName.replace(/\.pdf$/i, ''),
    ...(author && { author }),
    fileType: 'pdf',
    pageCount: extracted.pageCount,
  };
}

function buildTextBook(base: BookBase, provided: ProvidedMetadata, buffer: Buffer): BookMetadata {
  const extracted = extractTextMetadata(buffer);
  return {
    ...base,
    title: provided.title || extracted.title || base.fileName.replace(/\.txt$/i, ''),
    ...(provided.author && { author: provided.author }),
    fileType: 'text',
    wordCount: extracted.wordCount,
  };
}

async function saveWithinQuota(
  userId: string,
  bookRef: FirebaseFirestore.DocumentReference,
  bookData: BookMetadata
) {
  await db.runTransaction(async (tx) => {
    const booksSnap = await tx.get(
      db.collection('users').doc(userId).collection('books').where('status', '==', 'ready')
    );
    let totalSize = 0;
    booksSnap.forEach((doc) => {
      const book = doc.data() as BookMetadata;
      totalSize += book.fileSize || 0;
    });
    if (totalSize + bookData.fileSize > MAX_USER_STORAGE) {
      throw new Error('Storage quota exceeded. Maximum is 1GB.');
    }
    tx.set(bookRef, bookData);
  });
}

export const processBookUpload = onObjectFinalized(
  {
    bucket: DEFAULT_BUCKET,
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    const upload = parsePendingUpload(event.data, 'books');
    if (!upload) return;

    const { filePath, userId, itemId: bookId, fileName, contentType, fileSize } = upload;
    const bookRef = db.collection('users').doc(userId).collection('books').doc(bookId);

    try {
      const isPdf = contentType === 'application/pdf' || fileName.endsWith('.pdf');
      const isText = contentType === 'text/plain' || fileName.endsWith('.txt');

      if (!isPdf && !isText) {
        throw new Error('Invalid file type. Only PDF and plain text files are supported.');
      }

      if (!(await isAdmin(userId)) && (await isKilled('books'))) {
        throw new Error('Book uploads are temporarily unavailable.');
      }

      if (fileSize > MAX_FILE_SIZE_BOOKS) {
        throw new Error('File too large. Maximum size is 50MB.');
      }

      const bucket = storage.bucket(event.data.bucket);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();

      const finalPath = `books/users/${userId}/${bookId}/${fileName}`;
      const base = {
        id: bookId,
        userId,
        fileName,
        fileSize,
        storagePath: finalPath,
        uploadedAt: Date.now(),
        status: 'ready' as const,
        color: await getUnusedColor(userId),
      };
      const provided = {
        title: getCustomMetadataValue(event.data.metadata, 'booktitle'),
        author: getCustomMetadataValue(event.data.metadata, 'bookauthor'),
      };
      const bookData = isPdf
        ? await buildPdfBook(base, provided, buffer)
        : buildTextBook(base, provided, buffer);

      await saveWithinQuota(userId, bookRef, bookData);

      await file.move(finalPath);

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

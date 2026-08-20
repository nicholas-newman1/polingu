import { onObjectFinalized } from 'firebase-functions/storage';
import { DEFAULT_BUCKET } from '../../shared/config.js';
import { db, storage } from '../../shared/firebase.js';
import { isKilled } from '../../shared/killSwitch.js';
import {
  BookMetadata,
  MAX_FILE_SIZE_BOOKS,
  MAX_USER_STORAGE,
  extractPdfMetadata,
  extractTextMetadata,
  getUnusedColor,
} from '../../shared/books.js';

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
      const isText = contentType === 'text/plain' || fileName.endsWith('.txt');

      if (!isPdf && !isText) {
        throw new Error('Invalid file type. Only PDF and plain text files are supported.');
      }

      let userIsAdmin = false;
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const user = await getAuth().getUser(userId);
        userIsAdmin = !!user.customClaims?.admin;
      } catch {
        userIsAdmin = false;
      }

      if (!userIsAdmin && (await isKilled('books'))) {
        throw new Error('Book uploads are temporarily unavailable.');
      }

      if (fileSize > MAX_FILE_SIZE_BOOKS) {
        throw new Error('File too large. Maximum size is 50MB.');
      }

      const bucket = storage.bucket(event.data.bucket);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();

      const finalPath = `books/users/${userId}/${bookId}/${fileName}`;
      const color = await getUnusedColor(userId);

      let bookData: BookMetadata;

      if (isPdf) {
        const extracted = await extractPdfMetadata(buffer);
        bookData = {
          id: bookId,
          userId,
          title: extracted.title || fileName.replace(/\.pdf$/i, ''),
          ...(extracted.author && { author: extracted.author }),
          fileName,
          fileSize,
          fileType: 'pdf',
          storagePath: finalPath,
          uploadedAt: Date.now(),
          status: 'ready',
          pageCount: extracted.pageCount,
          color,
        };
      } else {
        const extracted = extractTextMetadata(buffer);
        const providedTitle = event.data.metadata?.bookTitle?.trim();
        const providedAuthor = event.data.metadata?.bookAuthor?.trim();

        bookData = {
          id: bookId,
          userId,
          title: providedTitle || extracted.title || fileName.replace(/\.txt$/i, ''),
          ...(providedAuthor && { author: providedAuthor }),
          fileName,
          fileSize,
          fileType: 'text',
          storagePath: finalPath,
          uploadedAt: Date.now(),
          status: 'ready',
          wordCount: extracted.wordCount,
          color,
        };
      }

      await db.runTransaction(async (tx) => {
        const booksSnap = await tx.get(
          db.collection('users').doc(userId).collection('books').where('status', '==', 'ready')
        );
        let totalSize = 0;
        booksSnap.forEach((doc) => {
          const book = doc.data() as BookMetadata;
          totalSize += book.fileSize || 0;
        });
        if (totalSize + fileSize > MAX_USER_STORAGE) {
          throw new Error('Storage quota exceeded. Maximum is 1GB.');
        }
        tx.set(bookRef, bookData);
      });

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

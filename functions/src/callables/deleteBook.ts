import { onCall, HttpsError } from 'firebase-functions/https';
import { DEFAULT_BUCKET } from '../shared/config.js';
import { db, storage } from '../shared/firebase.js';
import { BookMetadata } from '../shared/books.js';

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

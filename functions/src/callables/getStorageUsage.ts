import { onCall, HttpsError } from 'firebase-functions/https';
import { MAX_USER_STORAGE, getUserStorageUsage } from '../shared/books.js';

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

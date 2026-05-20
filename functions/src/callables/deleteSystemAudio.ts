import { onCall, HttpsError } from 'firebase-functions/https';
import { DEFAULT_BUCKET } from '../shared/config.js';
import { db, storage } from '../shared/firebase.js';

interface DeleteSystemAudioRequest {
  id: string;
}

export const deleteSystemAudio = onCall<DeleteSystemAudioRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { id } = request.data;
    if (!id) {
      throw new HttpsError('invalid-argument', 'ID required.');
    }

    const docRef = db.collection('systemAudioItems').doc(id);
    const docSnap = await docRef.get();
    const storagePath = docSnap.data()?.storagePath;

    if (storagePath) {
      try {
        await storage.bucket(DEFAULT_BUCKET).file(storagePath).delete();
      } catch {
        // File might not exist
      }
    }

    await docRef.delete();

    return { success: true };
  }
);

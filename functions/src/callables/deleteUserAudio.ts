import { onCall, HttpsError } from 'firebase-functions/https';
import { DEFAULT_BUCKET } from '../shared/config.js';
import { db, storage } from '../shared/firebase.js';
import { AudioItemData } from '../shared/userAudio.js';

interface DeleteAudioRequest {
  audioId: string;
}

export const deleteUserAudio = onCall<DeleteAudioRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { audioId } = request.data;

    if (!audioId) {
      throw new HttpsError('invalid-argument', 'Audio ID required.');
    }

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);
    const audioDoc = await audioRef.get();

    if (!audioDoc.exists) {
      throw new HttpsError('not-found', 'Audio item not found.');
    }

    const audio = audioDoc.data() as AudioItemData;

    if (audio.userId !== userId) {
      throw new HttpsError('permission-denied', 'Not your audio item.');
    }

    if (audio.storagePath) {
      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(audio.storagePath).delete();
      } catch {
        // File might not exist
      }
    }

    await audioRef.delete();

    return { success: true };
  }
);

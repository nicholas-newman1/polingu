import { onCall, HttpsError } from 'firebase-functions/https';
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../shared/firebase.js';
import { PROCESS_SYSTEM_AUDIO_QUEUE } from '../shared/queueNames.js';

interface CreateSystemAudioRequest {
  title: string;
  text: string;
}

export const createSystemAudio = onCall<CreateSystemAudioRequest, Promise<{ id: string }>>(
  async (request) => {
    if (!request.auth?.token.admin) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { title, text } = request.data;
    if (!title || typeof title !== 'string') {
      throw new HttpsError('invalid-argument', 'Title is required.');
    }
    if (!text || typeof text !== 'string' || text.length > 50000) {
      throw new HttpsError('invalid-argument', 'Valid text required (max 50,000 chars).');
    }

    const docRef = db.collection('systemAudioItems').doc();
    const id = docRef.id;

    await docRef.set({
      id,
      title,
      text,
      storagePath: '',
      duration: 0,
      status: 'processing',
      transcript: [],
      createdAt: Date.now(),
    });

    try {
      const queue = getFunctions().taskQueue(PROCESS_SYSTEM_AUDIO_QUEUE);
      await queue.enqueue({ id }, { dispatchDeadlineSeconds: 600 });
    } catch (error) {
      console.error(`Failed to queue system audio ${id}:`, error);
      // Nothing will ever process the item, so remove it rather than leaving it
      // "processing" forever in the system audio list.
      await docRef.delete();
      throw new HttpsError('unavailable', 'Could not start generating audio. Please try again.');
    }

    return { id };
  }
);

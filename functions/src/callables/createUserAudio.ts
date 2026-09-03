import { onCall, HttpsError } from 'firebase-functions/https';
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../shared/firebase.js';
import { assertNotKilled } from '../shared/killSwitch.js';
import { isAdmin } from '../shared/auth.js';
import { MAX_TEXT_CHARS_USER, reserveUserAudioSlot } from '../shared/userAudio.js';
import { PROCESS_USER_TEXT_AUDIO_QUEUE } from '../shared/queueNames.js';

interface CreateUserAudioRequest {
  title: string;
  text: string;
}

export const createUserAudio = onCall<CreateUserAudioRequest, Promise<{ id: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { title, text } = request.data;

    if (!request.auth.token.admin) {
      await assertNotKilled('audio');
    }

    if (!title || typeof title !== 'string') {
      throw new HttpsError('invalid-argument', 'Title is required.');
    }
    if (!text || typeof text !== 'string' || text.length > MAX_TEXT_CHARS_USER) {
      throw new HttpsError(
        'invalid-argument',
        `Valid text required (max ${MAX_TEXT_CHARS_USER} chars).`
      );
    }

    const userIsAdmin = await isAdmin(userId);

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc();
    const audioId = audioRef.id;

    try {
      await reserveUserAudioSlot(
        userId,
        audioRef,
        {
          id: audioId,
          userId,
          title,
          fileName: 'audio.mp3',
          duration: 0,
          fileSize: 0,
          storagePath: '',
          status: 'processing',
          transcript: [],
          createdAt: Date.now(),
        },
        userIsAdmin
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audio limit reached.';
      throw new HttpsError('resource-exhausted', message);
    }

    const queue = getFunctions().taskQueue(PROCESS_USER_TEXT_AUDIO_QUEUE);
    await queue.enqueue({ userId, audioId, text }, { dispatchDeadlineSeconds: 600 });

    return { id: audioId };
  }
);

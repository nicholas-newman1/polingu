import { onObjectFinalized } from 'firebase-functions/storage';
import { getFunctions } from 'firebase-admin/functions';
import { DEFAULT_BUCKET } from '../../shared/config.js';
import { parsePendingUpload } from '../../shared/pendingUpload.js';
import { db, storage } from '../../shared/firebase.js';
import { isKilled } from '../../shared/killSwitch.js';
import { isAdmin } from '../../shared/auth.js';
import {
  AudioItemData,
  MAX_FILE_SIZE_USER_AUDIO,
  isAcceptedAudio,
  reserveUserAudioSlot,
} from '../../shared/userAudio.js';
import { TRANSCRIBE_AUDIO_QUEUE } from '../../shared/queueNames.js';

export const processAudioUpload = onObjectFinalized(
  {
    bucket: DEFAULT_BUCKET,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const upload = parsePendingUpload(event.data, 'audio');
    if (!upload) return;

    const { filePath, userId, itemId: audioId, fileName, contentType, fileSize } = upload;
    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);

    try {
      if (!isAcceptedAudio(contentType, fileName)) {
        throw new Error('Invalid file type. Supported: MP3, WAV, OGG, FLAC, M4A.');
      }

      const userIsAdmin = await isAdmin(userId);

      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      if (!userIsAdmin && fileSize > MAX_FILE_SIZE_USER_AUDIO) {
        throw new Error('File too large. Maximum size is 25MB.');
      }

      const title = fileName.replace(/\.[^.]+$/, '');

      await reserveUserAudioSlot(
        userId,
        audioRef,
        {
          id: audioId,
          userId,
          title,
          fileName,
          duration: 0,
          fileSize,
          storagePath: '',
          status: 'processing',
          transcript: [],
          createdAt: Date.now(),
        },
        userIsAdmin
      );

      const queue = getFunctions().taskQueue(TRANSCRIBE_AUDIO_QUEUE);
      await queue.enqueue(
        { userId, audioId, fileName, bucket: event.data.bucket, filePath },
        { dispatchDeadlineSeconds: 600 }
      );

      console.log(`Enqueued transcription task for audio ${audioId} (user ${userId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`Failed to process audio upload ${audioId}:`, error);

      await audioRef.set({
        id: audioId,
        userId,
        title: fileName.replace(/\.[^.]+$/, ''),
        fileName,
        duration: 0,
        fileSize,
        storagePath: '',
        status: 'error',
        error: errorMessage,
        transcript: [],
        createdAt: Date.now(),
      } satisfies AudioItemData);

      try {
        const bucket = storage.bucket(event.data.bucket);
        await bucket.file(filePath).delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
);

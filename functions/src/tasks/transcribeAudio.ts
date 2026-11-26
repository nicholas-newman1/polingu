import { onTaskDispatched } from 'firebase-functions/tasks';
import { db, storage } from '../shared/firebase.js';
import { openaiApiKey } from '../shared/secrets.js';
import { isKilled } from '../shared/killSwitch.js';
import { isAdmin } from '../shared/auth.js';
import { MAX_DURATION_SECONDS, parseAudioDurationSeconds } from '../shared/userAudio.js';
import { transcribePolishAudio } from '../shared/transcription.js';

const MAX_ATTEMPTS = 2;

interface TranscribeTaskData {
  userId: string;
  audioId: string;
  fileName: string;
  bucket: string;
  filePath: string;
}

/** A refusal shown to the learner as-is; running the task again would not change it. */
class RejectedUpload extends Error {}

async function assertHeaderDurationAllowed(buffer: Buffer, contentType: string | undefined) {
  const headerDuration = await parseAudioDurationSeconds(buffer, contentType);
  if (headerDuration === null) {
    throw new RejectedUpload('Could not determine audio duration. File may be corrupt.');
  }
  if (headerDuration > MAX_DURATION_SECONDS) {
    throw new RejectedUpload('Audio too long. Maximum duration is 10 minutes.');
  }
}

export const transcribeAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: MAX_ATTEMPTS, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const {
      userId,
      audioId,
      fileName,
      bucket: bucketName,
      filePath,
    } = req.data as TranscribeTaskData;

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);
    const file = storage.bucket(bucketName).file(filePath);

    const removeUpload = async () => {
      try {
        await file.delete();
      } catch {
        // Ignore cleanup errors
      }
    };

    try {
      // Cloud Tasks delivers at least once, so this may repeat a task that already
      // finished (ready, or failed with the reason the learner sees). Leave those alone.
      const item = await audioRef.get();
      if (!item.exists) {
        console.log(`Audio ${audioId} was deleted before transcription; removing its upload`);
        await removeUpload();
        return;
      }
      if (item.data()?.status !== 'processing') {
        console.log(`Audio ${audioId} is already ${item.data()?.status}; nothing to do`);
        return;
      }

      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      const userIsAdmin = await isAdmin(userId);

      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new RejectedUpload('Audio processing is temporarily unavailable.');
      }

      if (!userIsAdmin) {
        await assertHeaderDurationAllowed(
          buffer,
          typeof metadata.contentType === 'string' ? metadata.contentType : undefined
        );
      }

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new RejectedUpload('OpenAI API key not configured');

      const { segments, words, duration } = await transcribePolishAudio(buffer, fileName, apiKey);

      if (!userIsAdmin && duration > MAX_DURATION_SECONDS) {
        throw new RejectedUpload('Audio too long. Maximum duration is 10 minutes.');
      }

      const finalPath = `audio/users/${userId}/${audioId}/${fileName}`;
      await file.move(finalPath);

      await audioRef.update({
        duration,
        storagePath: finalPath,
        status: 'ready',
        transcript: segments,
      });

      console.log(
        `Transcription complete for audio ${audioId}: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const rejected = error instanceof RejectedUpload;
      // retryCount comes from a Cloud Tasks header: 0 on the first attempt.
      const finalAttempt = (req.retryCount ?? 0) >= MAX_ATTEMPTS - 1;

      if (!rejected && !finalAttempt) {
        // Possibly transient (Whisper, Storage, Firestore): keep the item processing and the
        // upload in place, and rethrow so Cloud Tasks runs the task again.
        console.warn(`Transcription attempt failed for audio ${audioId}; will retry:`, error);
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      console.error(`Transcription failed for audio ${audioId}:`, error);

      await audioRef.update({
        status: 'error',
        error: errorMessage,
      });
      await removeUpload();

      // A rejection is final, so report success to stop Cloud Tasks retrying it.
      if (!rejected) throw error;
    }
  }
);

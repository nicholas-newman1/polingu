import { onTaskDispatched } from 'firebase-functions/tasks';
import { db, storage } from '../shared/firebase.js';
import { openaiApiKey } from '../shared/secrets.js';
import { isKilled } from '../shared/killSwitch.js';
import { isAdmin } from '../shared/auth.js';
import { MAX_DURATION_SECONDS, parseAudioDurationSeconds } from '../shared/userAudio.js';
import { transcribePolishAudio } from '../shared/transcription.js';

interface TranscribeTaskData {
  userId: string;
  audioId: string;
  fileName: string;
  bucket: string;
  filePath: string;
}

export const transcribeAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
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

    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      const userIsAdmin = await isAdmin(userId);

      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      if (!userIsAdmin) {
        const headerDuration = await parseAudioDurationSeconds(
          buffer,
          typeof metadata.contentType === 'string' ? metadata.contentType : undefined
        );
        if (headerDuration === null) {
          throw new Error('Could not determine audio duration. File may be corrupt.');
        }
        if (headerDuration > MAX_DURATION_SECONDS) {
          throw new Error('Audio too long. Maximum duration is 10 minutes.');
        }
      }

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new Error('OpenAI API key not configured');

      const { segments, words, duration } = await transcribePolishAudio(buffer, fileName, apiKey);

      if (!userIsAdmin && duration > MAX_DURATION_SECONDS) {
        throw new Error('Audio too long. Maximum duration is 10 minutes.');
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
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      console.error(`Transcription failed for audio ${audioId}:`, error);

      await audioRef.update({
        status: 'error',
        error: errorMessage,
      });

      try {
        const bucket = storage.bucket(bucketName);
        await bucket.file(filePath).delete();
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }
);

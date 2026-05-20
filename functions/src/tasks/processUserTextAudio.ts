import { onTaskDispatched } from 'firebase-functions/tasks';
import { DEFAULT_BUCKET } from '../shared/config.js';
import { db, storage } from '../shared/firebase.js';
import { openaiApiKey } from '../shared/secrets.js';
import { isKilled } from '../shared/killSwitch.js';
import { isAdmin } from '../shared/auth.js';
import { synthesizeChunkedTTS } from '../shared/tts.js';
import { transcribePolishAudio } from '../shared/transcription.js';

interface ProcessUserTextAudioTaskData {
  userId: string;
  audioId: string;
  text: string;
}

export const processUserTextAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { userId, audioId, text } = req.data as ProcessUserTextAudioTaskData;
    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);

    try {
      const userIsAdmin = await isAdmin(userId);
      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      const audioBuffer = await synthesizeChunkedTTS(text);
      const finalPath = `audio/users/${userId}/${audioId}/audio.mp3`;
      const bucket = storage.bucket(DEFAULT_BUCKET);

      await bucket.file(finalPath).save(audioBuffer, {
        contentType: 'audio/mpeg',
      });

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new Error('OpenAI API key not configured.');

      const { segments, words, duration } = await transcribePolishAudio(
        audioBuffer,
        'audio.mp3',
        apiKey
      );

      await audioRef.update({
        fileSize: audioBuffer.length,
        duration,
        storagePath: finalPath,
        status: 'ready',
        transcript: segments,
      });

      console.log(
        `User text audio ${audioId} ready: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`User text audio processing failed for ${audioId}:`, error);

      await audioRef.update({ status: 'error', error: errorMessage });

      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(`audio/users/${userId}/${audioId}/audio.mp3`).delete();
      } catch {
        // File might not exist yet
      }

      throw error;
    }
  }
);

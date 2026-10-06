import { onTaskDispatched } from 'firebase-functions/tasks';
import { DEFAULT_BUCKET } from '../shared/config.js';
import { db, storage } from '../shared/firebase.js';
import { openaiApiKey } from '../shared/secrets.js';
import { synthesizeAndTranscribe } from '../shared/textAudio.js';
import type { TranscriptSegment } from '../shared/transcription.js';

interface ProcessSystemAudioTaskData {
  id: string;
}

export const processSystemAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { id } = req.data as ProcessSystemAudioTaskData;
    const docRef = db.collection('systemAudioItems').doc(id);

    try {
      const docSnap = await docRef.get();
      if (!docSnap.exists) throw new Error('System audio doc not found.');
      const row = docSnap.data() as { text: string };
      const { text } = row;

      const finalPath = `audio/system/${id}/audio.mp3`;
      const { segments, words, duration } = await synthesizeAndTranscribe(
        text,
        finalPath,
        'system-audio.mp3'
      );

      await docRef.update({
        storagePath: finalPath,
        duration,
        status: 'ready',
        transcript: segments satisfies TranscriptSegment[],
      });

      console.log(
        `System audio ${id} ready: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`System audio processing failed for ${id}:`, error);

      await docRef.update({ status: 'error', error: errorMessage });

      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(`audio/system/${id}/audio.mp3`).delete();
      } catch {
        // File might not exist yet
      }

      throw error;
    }
  }
);

import { onTaskDispatched } from 'firebase-functions/tasks';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firebase.js';
import { synthesizeAndUploadAudio } from '../shared/audioTypes.js';
import { CardAudioStatus } from '../shared/cardAudio.js';

export interface VerbAudioJob {
  fieldPath: string;
  text: string;
  audioType: 'verb-infinitive' | 'conjugation';
  subPath?: string;
}

export interface GenerateVerbAudioTaskData {
  docId: string;
  jobs: VerbAudioJob[];
}

export const generateVerbAudio = onTaskDispatched<GenerateVerbAudioTaskData>(
  {
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { docId, jobs } = req.data;
    const docRef = db.collection('verbs').doc(docId);

    const updates: Record<string, unknown> = {};
    const failures: string[] = [];

    for (const job of jobs) {
      try {
        const url = await synthesizeAndUploadAudio(job.text, job.audioType, docId, job.subPath);
        if (!url) {
          failures.push(`${job.fieldPath}: empty TTS response`);
          continue;
        }
        updates[job.fieldPath] = url;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Audio generation failed';
        failures.push(`${job.fieldPath}: ${message}`);
        console.error(`generateVerbAudio: ${job.fieldPath} failed for verbs/${docId}:`, error);
      }
    }

    const successCount = Object.keys(updates).length;

    if (failures.length === 0) {
      updates.audioStatus = 'ready' satisfies CardAudioStatus;
      updates.audioError = FieldValue.delete();
    } else {
      updates.audioStatus = 'error' satisfies CardAudioStatus;
      const preview = failures.slice(0, 5).join('; ');
      const suffix = failures.length > 5 ? ` (+${failures.length - 5} more)` : '';
      updates.audioError = `${failures.length} of ${jobs.length} job(s) failed: ${preview}${suffix}`;
    }

    try {
      await docRef.update(updates);
      console.log(
        `generateVerbAudio: verbs/${docId} wrote ${successCount} url(s), ${failures.length} failure(s)`
      );
    } catch (error) {
      console.error(`generateVerbAudio: failed to persist updates for verbs/${docId}:`, error);
      throw error;
    }

    if (successCount === 0 && failures.length > 0) {
      throw new Error(`All ${failures.length} verb audio jobs failed for verbs/${docId}`);
    }
  }
);

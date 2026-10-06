import { onDocumentWritten } from 'firebase-functions/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../../shared/firebase.js';
import { CardAudioStatus } from '../../shared/cardAudio.js';
import { GENERATE_VERB_AUDIO_QUEUE } from '../../shared/queueNames.js';
import type { GenerateVerbAudioTaskData, VerbAudioJob } from '../../tasks/generateVerbAudio.js';

interface ConjugationFormData {
  pl?: string;
  audioUrl?: string;
  [key: string]: unknown;
}

type ConjugationsData = Record<string, Record<string, ConjugationFormData>>;

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** On create, fills in missing audio; on update, regenerates only when the text changed. */
function needsAudio(isCreate: boolean, hasAudio: boolean, before: string, after: string) {
  return isCreate ? !hasAudio : before !== after;
}

function collectVerbAudioJobs(
  docId: string,
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData
): VerbAudioJob[] {
  const isCreate = !before;
  const jobs: VerbAudioJob[] = [];

  const afterInf = trimmed(after.infinitive);
  if (
    afterInf &&
    needsAudio(isCreate, !!after.infinitiveAudioUrl, trimmed(before?.infinitive), afterInf)
  ) {
    jobs.push({ fieldPath: 'infinitiveAudioUrl', text: afterInf, audioType: 'verb-infinitive' });
  }

  const beforeConj = (before?.conjugations ?? {}) as ConjugationsData;
  const afterConj = (after.conjugations ?? {}) as ConjugationsData;

  for (const [tense, forms] of Object.entries(afterConj)) {
    for (const [formKey, form] of Object.entries(forms)) {
      const afterPl = trimmed(form.pl);
      const beforePl = trimmed(beforeConj[tense]?.[formKey]?.pl);
      if (!afterPl || !needsAudio(isCreate, !!form.audioUrl, beforePl, afterPl)) continue;

      jobs.push({
        fieldPath: `conjugations.${tense}.${formKey}.audioUrl`,
        text: afterPl,
        audioType: 'conjugation',
        subPath: `${docId}_${tense}_${formKey}`,
      });
    }
  }

  return jobs;
}

export const onVerbWrite = onDocumentWritten('verbs/{docId}', async (event) => {
  const { docId } = event.params;
  const after = event.data?.after?.data();
  if (!after) return;

  const jobs = collectVerbAudioJobs(docId, event.data?.before?.data(), after);
  if (jobs.length === 0) return;

  const docRef = db.collection('verbs').doc(docId);
  try {
    await docRef.update({
      audioStatus: 'generating' satisfies CardAudioStatus,
      audioError: FieldValue.delete(),
    });
  } catch (error) {
    console.error(`Failed to mark verbs/${docId} generating:`, error);
  }

  try {
    const queue = getFunctions().taskQueue(GENERATE_VERB_AUDIO_QUEUE);
    await queue.enqueue({ docId, jobs } satisfies GenerateVerbAudioTaskData, {
      dispatchDeadlineSeconds: 600,
    });
    console.log(`Enqueued ${jobs.length} audio job(s) for verbs/${docId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enqueue audio task';
    console.error(`Failed to enqueue verb audio task for verbs/${docId}:`, error);
    try {
      await docRef.update({
        audioStatus: 'error' satisfies CardAudioStatus,
        audioError: message,
      });
    } catch (updateErr) {
      console.error(`Failed to record enqueue error for verbs/${docId}:`, updateErr);
    }
  }
});

import { onDocumentWritten } from 'firebase-functions/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/firebase.js';
import { openaiApiKey } from '../../shared/secrets.js';
import { CEFRLevel, assessSentenceCEFR } from '../../shared/cefr.js';
import {
  VOCAB_EXAMPLE_SOURCE,
  VOCAB_EXAMPLE_TAG,
  VocabExampleDoc,
  mirrorSentenceIdFor,
} from '../../shared/vocabMirror.js';

export const onVocabularyExamplesWrite = onDocumentWritten(
  { document: 'vocabulary/{wordId}', secrets: [openaiApiKey] },
  async (event) => {
    const wordId = event.params.wordId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) {
      if (!before) return;
      const examples = (before.examples ?? []) as VocabExampleDoc[];
      for (const ex of examples) {
        if (!ex.id) continue;
        const sentenceId = mirrorSentenceIdFor(wordId, ex.id);
        try {
          await db.collection('sentences').doc(sentenceId).delete();
        } catch (error) {
          console.error(`Failed to delete mirror sentence ${sentenceId}:`, error);
        }
      }
      return;
    }

    const beforeExamples = (before?.examples ?? []) as VocabExampleDoc[];
    const afterExamples = (after.examples ?? []) as VocabExampleDoc[];

    const beforeById = new Map<string, VocabExampleDoc>();
    for (const ex of beforeExamples) {
      if (ex.id) beforeById.set(ex.id, ex);
    }
    const afterById = new Map<string, VocabExampleDoc>();
    for (const ex of afterExamples) {
      if (ex.id) afterById.set(ex.id, ex);
    }

    for (const exId of beforeById.keys()) {
      if (afterById.has(exId)) continue;
      const sentenceId = mirrorSentenceIdFor(wordId, exId);
      try {
        await db.collection('sentences').doc(sentenceId).delete();
      } catch (error) {
        console.error(`Failed to delete mirror sentence ${sentenceId}:`, error);
      }
    }

    for (const [exId, afterEx] of afterById) {
      const polish = (afterEx.polish ?? '').trim();
      const english = (afterEx.english ?? '').trim();
      if (!polish || !english) continue;

      const beforeEx = beforeById.get(exId);
      const beforePolish = (beforeEx?.polish ?? '').trim();
      const beforeEnglish = (beforeEx?.english ?? '').trim();

      if (beforeEx && beforePolish === polish && beforeEnglish === english) continue;

      const sentenceId = mirrorSentenceIdFor(wordId, exId);
      const sentenceRef = db.collection('sentences').doc(sentenceId);
      const sentenceSnap = await sentenceRef.get();
      const existing = sentenceSnap.data();

      if (
        existing &&
        ((existing.polish as string) ?? '') === polish &&
        ((existing.english as string) ?? '') === english
      ) {
        continue;
      }

      const isCreate = !existing;
      const polishChanged = isCreate || beforePolish !== polish;

      let newLevel: CEFRLevel | null = null;
      if (polishChanged) {
        const apiKey = openaiApiKey.value();
        if (apiKey) {
          newLevel = await assessSentenceCEFR(polish, apiKey);
        }
      }

      if (isCreate) {
        if (!newLevel) {
          console.warn(
            `onVocabularyExamplesWrite: CEFR assessment failed for vocabulary/${wordId} example ${exId} - skipping mirror sentence creation`
          );
          continue;
        }
        try {
          await sentenceRef.set({
            id: sentenceId,
            polish,
            english,
            level: newLevel,
            tags: [VOCAB_EXAMPLE_TAG],
            source: VOCAB_EXAMPLE_SOURCE,
            sourceVocabularyId: wordId,
            sourceExampleId: exId,
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log(`Created mirror sentence ${sentenceId}`);
        } catch (error) {
          console.error(`Failed to create mirror sentence ${sentenceId}:`, error);
        }
        continue;
      }

      const updates: Record<string, unknown> = { polish, english };
      if (polishChanged && newLevel) {
        updates.level = newLevel;
      }
      try {
        await sentenceRef.update(updates);
      } catch (error) {
        console.error(`Failed to update mirror sentence ${sentenceId}:`, error);
      }
    }
  }
);

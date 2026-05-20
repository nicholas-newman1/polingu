import { onDocumentWritten } from 'firebase-functions/firestore';
import { db } from '../../shared/firebase.js';
import { openaiApiKey } from '../../shared/secrets.js';
import { CEFRLevel, assessSentenceCEFR } from '../../shared/cefr.js';
import {
  VOCAB_EXAMPLE_SOURCE,
  VOCAB_EXAMPLE_TAG,
  VocabExampleDoc,
  customMirrorSentenceIdFor,
} from '../../shared/vocabMirror.js';

export const onCustomVocabularyExamplesWrite = onDocumentWritten(
  { document: 'users/{userId}/customVocabulary/{wordId}', secrets: [openaiApiKey] },
  async (event) => {
    const { userId, wordId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const sentencesCol = db.collection('users').doc(userId).collection('customSentences');

    if (!after) {
      if (!before) return;
      const examples = (before.examples ?? []) as VocabExampleDoc[];
      for (const ex of examples) {
        if (!ex.id) continue;
        const sentenceId = customMirrorSentenceIdFor(wordId, ex.id);
        try {
          await sentencesCol.doc(sentenceId).delete();
        } catch (error) {
          console.error(
            `Failed to delete custom mirror sentence users/${userId}/customSentences/${sentenceId}:`,
            error
          );
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
      const sentenceId = customMirrorSentenceIdFor(wordId, exId);
      try {
        await sentencesCol.doc(sentenceId).delete();
      } catch (error) {
        console.error(
          `Failed to delete custom mirror sentence users/${userId}/customSentences/${sentenceId}:`,
          error
        );
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

      const sentenceId = customMirrorSentenceIdFor(wordId, exId);
      const sentenceRef = sentencesCol.doc(sentenceId);
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
            `onCustomVocabularyExamplesWrite: CEFR assessment failed for users/${userId}/customVocabulary/${wordId} example ${exId} - skipping custom mirror creation`
          );
          continue;
        }
        try {
          await sentenceRef.set({
            id: sentenceId,
            isCustom: true,
            createdAt: Date.now(),
            polish,
            english,
            level: newLevel,
            tags: [VOCAB_EXAMPLE_TAG],
            source: VOCAB_EXAMPLE_SOURCE,
            sourceVocabularyId: wordId,
            sourceExampleId: exId,
          });
          console.log(
            `Created custom mirror sentence users/${userId}/customSentences/${sentenceId}`
          );
        } catch (error) {
          console.error(
            `Failed to create custom mirror sentence users/${userId}/customSentences/${sentenceId}:`,
            error
          );
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
        console.error(
          `Failed to update custom mirror sentence users/${userId}/customSentences/${sentenceId}:`,
          error
        );
      }
    }
  }
);

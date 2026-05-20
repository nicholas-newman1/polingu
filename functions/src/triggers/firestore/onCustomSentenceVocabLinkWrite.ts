import { onDocumentWritten } from 'firebase-functions/firestore';
import { db } from '../../shared/firebase.js';
import { VOCAB_EXAMPLE_SOURCE, VocabExampleDoc } from '../../shared/vocabMirror.js';

export const onCustomSentenceVocabLinkWrite = onDocumentWritten(
  'users/{userId}/customSentences/{sentenceId}',
  async (event) => {
    const { userId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) {
      if (!before) return;
      if (before.source !== VOCAB_EXAMPLE_SOURCE) return;
      const vocabId = before.sourceVocabularyId as string | undefined;
      const exampleId = before.sourceExampleId as string | undefined;
      if (!vocabId || !exampleId) return;

      const vocabRef = db
        .collection('users')
        .doc(userId)
        .collection('customVocabulary')
        .doc(vocabId);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(vocabRef);
          if (!snap.exists) return;
          const data = snap.data()!;
          const examples = (data.examples ?? []) as VocabExampleDoc[];
          const filtered = examples.filter((ex) => ex.id !== exampleId);
          if (filtered.length === examples.length) return;
          tx.update(vocabRef, { examples: filtered });
        });
      } catch (error) {
        console.error(
          `Failed to remove custom vocab example users/${userId}/customVocabulary/${vocabId}/${exampleId} after sentence delete:`,
          error
        );
      }
      return;
    }

    if (after.source !== VOCAB_EXAMPLE_SOURCE) return;

    const vocabId = after.sourceVocabularyId as string | undefined;
    const exampleId = after.sourceExampleId as string | undefined;
    if (!vocabId || !exampleId) return;

    const afterPolish = ((after.polish as string) ?? '').trim();
    const afterEnglish = ((after.english as string) ?? '').trim();
    if (!afterPolish || !afterEnglish) return;

    const beforePolish = ((before?.polish as string) ?? '').trim();
    const beforeEnglish = ((before?.english as string) ?? '').trim();

    if (before && beforePolish === afterPolish && beforeEnglish === afterEnglish) return;

    const vocabRef = db.collection('users').doc(userId).collection('customVocabulary').doc(vocabId);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(vocabRef);
        if (!snap.exists) return;
        const data = snap.data()!;
        const examples = (data.examples ?? []) as VocabExampleDoc[];
        const idx = examples.findIndex((ex) => ex.id === exampleId);
        if (idx === -1) return;
        const current = examples[idx];
        const currentPolish = ((current.polish as string) ?? '').trim();
        const currentEnglish = ((current.english as string) ?? '').trim();
        if (currentPolish === afterPolish && currentEnglish === afterEnglish) return;
        const next = [...examples];
        next[idx] = { ...current, polish: afterPolish, english: afterEnglish };
        tx.update(vocabRef, { examples: next });
      });
    } catch (error) {
      console.error(
        `Failed to propagate custom sentence edit back to users/${userId}/customVocabulary/${vocabId} example ${exampleId}:`,
        error
      );
    }
  }
);

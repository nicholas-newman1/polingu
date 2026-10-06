import { onDocumentWritten } from 'firebase-functions/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/firebase.js';
import { openaiApiKey } from '../../shared/secrets.js';
import { mirrorSentenceIdFor } from '../../shared/vocabMirror.js';
import { syncMirrorSentences } from '../../shared/vocabMirrorSync.js';

export const onVocabularyExamplesWrite = onDocumentWritten(
  { document: 'vocabulary/{wordId}', secrets: [openaiApiKey] },
  async (event) => {
    const { wordId } = event.params;
    await syncMirrorSentences(event.data?.before?.data(), event.data?.after?.data(), {
      wordId,
      sentences: db.collection('sentences'),
      mirrorIdFor: mirrorSentenceIdFor,
      describe: (sentenceId) => `mirror sentence ${sentenceId}`,
      logPrefix: `onVocabularyExamplesWrite: CEFR assessment failed for vocabulary/${wordId}`,
      createFields: () => ({ createdAt: FieldValue.serverTimestamp() }),
    });
  }
);

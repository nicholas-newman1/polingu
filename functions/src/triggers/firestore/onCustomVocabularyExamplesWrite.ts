import { onDocumentWritten } from 'firebase-functions/firestore';
import { db } from '../../shared/firebase.js';
import { openaiApiKey } from '../../shared/secrets.js';
import { customMirrorSentenceIdFor } from '../../shared/vocabMirror.js';
import { syncMirrorSentences } from '../../shared/vocabMirrorSync.js';

export const onCustomVocabularyExamplesWrite = onDocumentWritten(
  { document: 'users/{userId}/customVocabulary/{wordId}', secrets: [openaiApiKey] },
  async (event) => {
    const { userId, wordId } = event.params;
    await syncMirrorSentences(event.data?.before?.data(), event.data?.after?.data(), {
      wordId,
      sentences: db.collection('users').doc(userId).collection('customSentences'),
      mirrorIdFor: customMirrorSentenceIdFor,
      describe: (sentenceId) =>
        `custom mirror sentence users/${userId}/customSentences/${sentenceId}`,
      logPrefix: `onCustomVocabularyExamplesWrite: CEFR assessment failed for users/${userId}/customVocabulary/${wordId}`,
      createFields: () => ({ isCustom: true, createdAt: Date.now() }),
    });
  }
);

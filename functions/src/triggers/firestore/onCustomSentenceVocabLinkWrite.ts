import { onDocumentWritten } from 'firebase-functions/firestore';
import { db } from '../../shared/firebase.js';
import { syncVocabExampleLink } from '../../shared/vocabMirrorSync.js';

export const onCustomSentenceVocabLinkWrite = onDocumentWritten(
  'users/{userId}/customSentences/{sentenceId}',
  (event) => {
    const { userId } = event.params;
    return syncVocabExampleLink(event.data?.before?.data(), event.data?.after?.data(), {
      vocabulary: db.collection('users').doc(userId).collection('customVocabulary'),
      describe: (vocabId) => `users/${userId}/customVocabulary/${vocabId}`,
    });
  }
);

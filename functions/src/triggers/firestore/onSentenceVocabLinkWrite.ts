import { onDocumentWritten } from 'firebase-functions/firestore';
import { db } from '../../shared/firebase.js';
import { syncVocabExampleLink } from '../../shared/vocabMirrorSync.js';

export const onSentenceVocabLinkWrite = onDocumentWritten('sentences/{sentenceId}', (event) =>
  syncVocabExampleLink(event.data?.before?.data(), event.data?.after?.data(), {
    vocabulary: db.collection('vocabulary'),
    describe: (vocabId) => `vocabulary/${vocabId}`,
  })
);

import { onDocumentWritten } from 'firebase-functions/firestore';
import { handleSystemCardAudioWrite } from '../../shared/cardAudio.js';

export const onVocabularyWrite = onDocumentWritten('vocabulary/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'vocabulary',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

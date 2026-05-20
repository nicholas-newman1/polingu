import { onDocumentWritten } from 'firebase-functions/firestore';
import { handleSystemCardAudioWrite } from '../../shared/cardAudio.js';

export const onSentenceWrite = onDocumentWritten('sentences/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'sentences',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

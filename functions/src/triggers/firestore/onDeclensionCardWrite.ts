import { onDocumentWritten } from 'firebase-functions/firestore';
import { handleSystemCardAudioWrite } from '../../shared/cardAudio.js';

export const onDeclensionCardWrite = onDocumentWritten('declensionCards/{docId}', async (event) => {
  await handleSystemCardAudioWrite(
    'declensionCards',
    event.params.docId,
    event.data?.before?.data(),
    event.data?.after?.data()
  );
});

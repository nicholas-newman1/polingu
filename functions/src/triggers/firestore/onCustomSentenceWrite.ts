import { onDocumentWritten } from 'firebase-functions/firestore';
import { CustomCardItem, handlePerCardWrite } from '../../shared/cardAudio.js';

export const onCustomSentenceWrite = onDocumentWritten(
  'users/{userId}/customSentences/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customSentences',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

import { onDocumentWritten } from 'firebase-functions/firestore';
import { CustomCardItem, handlePerCardWrite } from '../../shared/cardAudio.js';

export const onCustomVocabularyWrite = onDocumentWritten(
  'users/{userId}/customVocabulary/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customVocabulary',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

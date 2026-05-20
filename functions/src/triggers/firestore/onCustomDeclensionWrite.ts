import { onDocumentWritten } from 'firebase-functions/firestore';
import { CustomCardItem, handlePerCardWrite } from '../../shared/cardAudio.js';

export const onCustomDeclensionWrite = onDocumentWritten(
  'users/{userId}/customDeclension/{cardId}',
  async (event) => {
    const { userId, cardId } = event.params;
    const after = event.data?.after;
    if (!after?.exists) return;
    await handlePerCardWrite(
      'customDeclension',
      userId,
      cardId,
      event.data?.before?.data() as CustomCardItem | undefined,
      after.data() as CustomCardItem | undefined,
      after.ref
    );
  }
);

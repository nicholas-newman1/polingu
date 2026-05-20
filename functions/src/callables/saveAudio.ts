import { onCall, HttpsError } from 'firebase-functions/https';
import { AudioType, updateFirestoreAudioUrl, uploadAudioBuffer } from '../shared/audioTypes.js';

interface SaveAudioRequest {
  audioBase64: string;
  type: AudioType;
  id: string;
  subPath?: string;
}

interface SaveAudioResponse {
  audioUrl: string;
}

export const saveAudio = onCall<SaveAudioRequest, Promise<SaveAudioResponse>>(async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { audioBase64, type, id, subPath } = request.data;
  const userId = request.auth.uid;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'Audio data required.');
  }

  if (!type || !id) {
    throw new HttpsError('invalid-argument', 'Type and ID required.');
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const audioUrl = await uploadAudioBuffer(audioBuffer, type, id, subPath, userId);

    await updateFirestoreAudioUrl(type, id, audioUrl, subPath, userId);

    return { audioUrl };
  } catch (error) {
    console.error('Storage error:', error);
    throw new HttpsError('internal', 'Failed to save audio.');
  }
});

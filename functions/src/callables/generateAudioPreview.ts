import { onCall, HttpsError } from 'firebase-functions/https';
import { AUDIO_CONFIG, TTS_VOICE } from '../shared/config.js';
import { getTtsClient } from '../shared/tts.js';
import { AudioType } from '../shared/audioTypes.js';

interface GenerateAudioPreviewRequest {
  text: string;
  type: AudioType;
}

interface GenerateAudioPreviewResponse {
  audioBase64: string;
}

export const generateAudioPreview = onCall<
  GenerateAudioPreviewRequest,
  Promise<GenerateAudioPreviewResponse>
>(async (request) => {
  if (!request.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  const { text } = request.data;

  if (!text || typeof text !== 'string' || text.length > 1000) {
    throw new HttpsError('invalid-argument', 'Valid text required (max 1000 chars).');
  }

  try {
    const ttsRequest = {
      input: { text },
      voice: TTS_VOICE,
      audioConfig: AUDIO_CONFIG,
    };

    const [response] = await getTtsClient().synthesizeSpeech(ttsRequest);

    if (!response.audioContent) {
      throw new Error('No audio content in response');
    }

    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');

    return { audioBase64 };
  } catch (error) {
    console.error('TTS error:', error);
    throw new HttpsError('internal', 'Failed to generate audio.');
  }
});

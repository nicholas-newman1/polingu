import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export type AudioType =
  | 'sentence'
  | 'declension'
  | 'vocabulary'
  | 'conjugation'
  | 'verb-infinitive'
  | 'custom-sentence'
  | 'custom-vocabulary'
  | 'custom-declension';

interface GenerateAudioPreviewRequest {
  text: string;
  type: AudioType;
}

interface GenerateAudioPreviewResponse {
  audioBase64: string;
}

interface SaveAudioRequest {
  audioBase64: string;
  type: AudioType;
  id: string;
  subPath?: string;
}

interface SaveAudioResponse {
  audioUrl: string;
}

const generateAudioPreviewFn = httpsCallable<
  GenerateAudioPreviewRequest,
  GenerateAudioPreviewResponse
>(functions, 'generateAudioPreview');

const saveAudioFn = httpsCallable<SaveAudioRequest, SaveAudioResponse>(functions, 'saveAudio');

/**
 * Generate an audio preview for the given text.
 * Returns base64 encoded audio data for preview playback.
 */
export async function generateAudioPreview(text: string, type: AudioType): Promise<string> {
  const result = await generateAudioPreviewFn({ text, type });
  return result.data.audioBase64;
}

/**
 * Save the generated audio to storage.
 * Returns the public URL of the saved audio.
 */
export async function saveAudio(
  audioBase64: string,
  type: AudioType,
  id: string,
  subPath?: string
): Promise<string> {
  const result = await saveAudioFn({ audioBase64, type, id, subPath });
  return result.data.audioUrl;
}

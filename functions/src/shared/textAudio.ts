import { DEFAULT_BUCKET } from './config.js';
import { storage } from './firebase.js';
import { openaiApiKey } from './secrets.js';
import { synthesizeChunkedTTS } from './tts.js';
import { transcribePolishAudio, TranscriptionResult } from './transcription.js';

/** Synthesizes `text` to MP3 at `storagePath`, then transcribes it for word timings. */
export async function synthesizeAndTranscribe(
  text: string,
  storagePath: string,
  transcriptionFileName: string
): Promise<TranscriptionResult & { audioBuffer: Buffer }> {
  const audioBuffer = await synthesizeChunkedTTS(text);

  await storage.bucket(DEFAULT_BUCKET).file(storagePath).save(audioBuffer, {
    contentType: 'audio/mpeg',
  });

  const apiKey = openaiApiKey.value();
  if (!apiKey) throw new Error('OpenAI API key not configured.');

  const transcription = await transcribePolishAudio(audioBuffer, transcriptionFileName, apiKey);
  return { ...transcription, audioBuffer };
}

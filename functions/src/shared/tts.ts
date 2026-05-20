import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { AUDIO_CONFIG, TTS_BYTE_LIMIT, TTS_VOICE } from './config.js';

let ttsClientInstance: TextToSpeechClient | null = null;

export function getTtsClient(): TextToSpeechClient {
  if (!ttsClientInstance) {
    ttsClientInstance = new TextToSpeechClient();
  }
  return ttsClientInstance;
}

export function chunkTextForTTS(text: string): string[] {
  if (Buffer.byteLength(text, 'utf8') <= TTS_BYTE_LIMIT) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (Buffer.byteLength(candidate, 'utf8') > TTS_BYTE_LIMIT && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function synthesizeChunkedTTS(text: string): Promise<Buffer> {
  const client = getTtsClient();
  const chunks = chunkTextForTTS(text);
  const audioChunks: Buffer[] = [];

  for (const chunk of chunks) {
    const [ttsResponse] = await client.synthesizeSpeech({
      input: { text: chunk },
      voice: TTS_VOICE,
      audioConfig: AUDIO_CONFIG,
    });
    if (!ttsResponse.audioContent) throw new Error('TTS produced no audio.');
    audioChunks.push(Buffer.from(ttsResponse.audioContent as Uint8Array));
  }

  return Buffer.concat(audioChunks);
}

import type { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { AUDIO_CONFIG, TTS_BYTE_LIMIT, TTS_VOICE } from './config.js';

let ttsClientInstance: TextToSpeechClient | null = null;

export async function getTtsClient(): Promise<TextToSpeechClient> {
  if (!ttsClientInstance) {
    const { TextToSpeechClient: Client } = await import('@google-cloud/text-to-speech');
    ttsClientInstance = new Client();
  }
  return ttsClientInstance;
}

const fits = (text: string) => Buffer.byteLength(text, 'utf8') <= TTS_BYTE_LIMIT;

/** Sentences with the punctuation and spacing after them, plus any unpunctuated tail. */
const SENTENCES = /[^.!?]*[.!?]+\s*|[^.!?]+$/g;
/** Words with the spacing around them. */
const WORDS = /\s*\S+\s*/g;

/** Cuts a word too long for one request between characters, never inside one. */
function splitWord(word: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of word) {
    if (!fits(current + char)) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  return [...parts, current];
}

/**
 * Splits text into requests of at most TTS_BYTE_LIMIT bytes, at sentence ends where
 * possible, then between words. No text is dropped.
 */
function chunkTextForTTS(text: string): string[] {
  if (fits(text)) return [text];

  const pieces = (text.match(SENTENCES) ?? []).flatMap((sentence) =>
    fits(sentence)
      ? [sentence]
      : (sentence.match(WORDS) ?? []).flatMap((word) => (fits(word) ? [word] : splitWord(word)))
  );

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && !fits(current + piece)) {
      chunks.push(current.trim());
      current = '';
    }
    current += piece;
  }
  chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export async function synthesizeChunkedTTS(text: string): Promise<Buffer> {
  const client = await getTtsClient();
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

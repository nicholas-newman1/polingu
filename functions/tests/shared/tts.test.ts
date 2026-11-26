import { describe, expect, test, vi } from 'vitest';
import { synthesizeChunkedTTS } from '../../src/shared/tts.js';
import { TTS_BYTE_LIMIT, TTS_VOICE } from '../../src/shared/config.js';
import { installFakes, tts } from '../support/sdk.js';

vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));

installFakes();

const texts = () => tts.requests.map((r) => r.input.text);
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

/** `count` sentences of about `size` bytes each, numbered so they stay distinguishable. */
function sentences(count: number, size: number, letter = 'a') {
  return Array.from({ length: count }, (_, i) => `${i}${letter.repeat(size - 3)}. `).join('');
}

describe('synthesizeChunkedTTS', () => {
  test('synthesizes short text in one request with the Polish voice', async () => {
    const audio = await synthesizeChunkedTTS('Dzień dobry.');

    expect(audio).toEqual(Buffer.from('mp3(Dzień dobry.)'));
    expect(tts.requests).toEqual([
      { input: { text: 'Dzień dobry.' }, voice: TTS_VOICE, audioConfig: { audioEncoding: 'MP3' } },
    ]);
  });

  test('splits long text at sentence ends into requests under the byte limit', async () => {
    const text = sentences(10, 1000);
    await synthesizeChunkedTTS(text);

    expect(tts.requests.length).toBeGreaterThan(1);
    for (const chunk of texts()) {
      expect(bytes(chunk)).toBeLessThanOrEqual(TTS_BYTE_LIMIT);
      expect(chunk).toMatch(/\.$/);
    }
    expect(texts().join(' ')).toBe(text.trim());
  });

  test('measures the limit in bytes, so Polish letters split sooner than ASCII', async () => {
    // 2000 characters of "ż" is 4000 bytes: over the limit despite being short in characters.
    const text = sentences(2, 1000, 'ż');
    expect(text.length).toBeLessThan(TTS_BYTE_LIMIT);

    await synthesizeChunkedTTS(text);
    expect(tts.requests).toHaveLength(2);
  });

  test('joins the audio of every chunk in reading order', async () => {
    const text = sentences(6, 1000);
    const audio = await synthesizeChunkedTTS(text);

    expect(audio.toString()).toBe(
      texts()
        .map((chunk) => `mp3(${chunk})`)
        .join('')
    );
  });

  test('short text without any punctuation is spoken in full', async () => {
    await synthesizeChunkedTTS('bez kropki na końcu');
    expect(texts()).toEqual(['bez kropki na końcu']);
  });

  // BUG: long text is split with /[^.!?]+[.!?]+\s*/g, which only matches runs that end
  // in sentence punctuation, so anything after the last full stop is silently dropped.
  // Expected: the final chunk ends with "i jeszcze ogon bez kropki". Actual: that text
  // is never sent to TTS, so the generated audio (and its transcript) stop early.
  test.fails('long text keeps a trailing fragment without a full stop', async () => {
    const text = `${sentences(4, 1000)}i jeszcze ogon bez kropki`;
    await synthesizeChunkedTTS(text);
    expect(texts().at(-1)).toMatch(/i jeszcze ogon bez kropki$/);
  });

  test('fails when a chunk comes back without audio', async () => {
    tts.respond = (text) => (text.startsWith('3') ? null : Buffer.from('ok'));
    await expect(synthesizeChunkedTTS(sentences(6, 1000))).rejects.toThrow(
      'TTS produced no audio.'
    );
  });
});

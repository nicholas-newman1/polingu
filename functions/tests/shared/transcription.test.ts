import { describe, expect, test, vi } from 'vitest';
import { transcribePolishAudio } from '../../src/shared/transcription.js';
import { installFakes, openai } from '../support/sdk.js';

vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

const word = (w: string, start: number, end: number) => ({ word: w, start, end });
const segmentWords = (result: Awaited<ReturnType<typeof transcribePolishAudio>>) =>
  result.segments.map((s) => s.words.map((w) => w.word));

describe('transcribePolishAudio', () => {
  test('asks Whisper for a Polish transcript with word and segment timings', async () => {
    const audio = Buffer.from('mp3 bytes');
    await transcribePolishAudio(audio, 'lesson.mp3', 'sk-whisper');

    expect(openai.apiKeys).toEqual(['sk-whisper']);
    expect(openai.transcriptionRequests).toEqual([
      {
        model: 'whisper-1',
        file: { name: 'lesson.mp3', buffer: audio },
        language: 'pl',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      },
    ]);
  });

  test('returns trimmed segments with their words and the duration', async () => {
    openai.transcription = {
      duration: 4.5,
      segments: [
        { text: ' Dzień dobry. ', start: 0, end: 2 },
        { text: ' Jak się masz? ', start: 2, end: 4.5 },
      ],
      words: [
        word('Dzień', 0, 0.6),
        word('dobry', 0.6, 1.4),
        word('Jak', 2.1, 2.4),
        word('się', 2.4, 2.7),
        word('masz', 2.7, 3.2),
      ],
    };

    const result = await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key');
    expect(result.duration).toBe(4.5);
    expect(result.segments).toEqual([
      {
        text: 'Dzień dobry.',
        startTime: 0,
        endTime: 2,
        words: [
          { word: 'Dzień', startTime: 0, endTime: 0.6, confidence: 1 },
          { word: 'dobry', startTime: 0.6, endTime: 1.4, confidence: 1 },
        ],
      },
      expect.objectContaining({ text: 'Jak się masz?', startTime: 2, endTime: 4.5 }),
    ]);
    expect(segmentWords(result)[1]).toEqual(['Jak', 'się', 'masz']);
    expect(result.words.map((w) => w.word)).toEqual(['Dzień', 'dobry', 'Jak', 'się', 'masz']);
  });

  test('a word starting exactly at a segment boundary belongs to the next segment', async () => {
    openai.transcription = {
      duration: 4,
      segments: [
        { text: 'a', start: 0, end: 2 },
        { text: 'b', start: 2, end: 4 },
      ],
      words: [word('pierwsze', 1, 2), word('drugie', 2, 3)],
    };

    const result = await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key');
    expect(segmentWords(result)).toEqual([['pierwsze'], ['drugie']]);
  });

  test('a word outside every segment is attached to the segment starting nearest to it', async () => {
    openai.transcription = {
      duration: 10,
      segments: [
        { text: 'a', start: 0, end: 2 },
        { text: 'b', start: 5, end: 7 },
      ],
      words: [word('w-przerwie', 4, 4.5), word('po-końcu', 9, 9.5), word('na-początku', 2.4, 3)],
    };

    const result = await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key');
    expect(segmentWords(result)).toEqual([['na-początku'], ['w-przerwie', 'po-końcu']]);
  });

  test('no word is lost or duplicated across segments', async () => {
    const words = Array.from({ length: 30 }, (_, i) => word(`w${i}`, i * 0.37, i * 0.37 + 0.3));
    openai.transcription = {
      duration: 12,
      segments: [
        { text: 'a', start: 0.5, end: 3 },
        { text: 'b', start: 3.2, end: 7 },
        { text: 'c', start: 8, end: 10 },
      ],
      words,
    };

    const result = await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key');
    expect(segmentWords(result).flat().sort()).toEqual(words.map((w) => w.word).sort());
  });

  test('keeps the words even when Whisper returns no segments', async () => {
    openai.transcription = { duration: 1, words: [word('tak', 0, 0.5)] };

    const result = await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key');
    expect(result.segments).toEqual([]);
    expect(result.words).toEqual([{ word: 'tak', startTime: 0, endTime: 0.5, confidence: 1 }]);
  });

  test('treats a response without duration, segments or words as empty', async () => {
    openai.transcription = {};
    expect(await transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key')).toEqual({
      segments: [],
      words: [],
      duration: 0,
    });
  });

  test('lets a Whisper failure propagate', async () => {
    openai.transcription = new Error('file too large');
    await expect(transcribePolishAudio(Buffer.from('x'), 'a.mp3', 'key')).rejects.toThrow(
      'file too large'
    );
  });
});

import type { TranscriptSegment } from '../../../src/types/audio';

/** A transcript line from `start` to `end` seconds, its words spread evenly across it. */
export function line(text: string, start: number, end: number): TranscriptSegment {
  const words = text.split(' ');
  const per = (end - start) / words.length;
  return {
    text,
    startTime: start,
    endTime: end,
    words: words.map((word, i) => ({
      word,
      startTime: start + i * per,
      endTime: start + (i + 1) * per,
      confidence: 1,
    })),
  };
}

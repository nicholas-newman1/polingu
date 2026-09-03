import OpenAI, { toFile } from 'openai';

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  duration: number;
}

export async function transcribePolishAudio(
  buffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const openai = new OpenAI({ apiKey });
  const audioFile = await toFile(buffer, fileName);

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
    language: 'pl',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });

  const duration = response.duration ?? 0;

  const segments: TranscriptSegment[] = (response.segments ?? []).map((seg) => ({
    text: seg.text.trim(),
    startTime: seg.start,
    endTime: seg.end,
    words: [],
  }));

  const words: TranscriptWord[] = (response.words ?? []).map((w) => ({
    word: w.word,
    startTime: w.start,
    endTime: w.end,
    confidence: 1,
  }));

  for (const word of words) {
    const seg = segments.find((s) => word.startTime >= s.startTime && word.startTime < s.endTime);
    if (seg) {
      seg.words.push(word);
    } else if (segments.length > 0) {
      const closest = segments.reduce((prev, curr) =>
        Math.abs(curr.startTime - word.startTime) < Math.abs(prev.startTime - word.startTime)
          ? curr
          : prev
      );
      closest.words.push(word);
    }
  }

  return { segments, words, duration };
}

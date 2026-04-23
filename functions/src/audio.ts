import { onObjectFinalized } from 'firebase-functions/storage';
import { onTaskDispatched } from 'firebase-functions/tasks';
import { onCall, HttpsError } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { getFunctions } from 'firebase-admin/functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import OpenAI, { toFile } from 'openai';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { assertNotKilled, isKilled } from './killSwitch.js';

const db = getFirestore();
const storage = getStorage();

const openaiApiKey = defineSecret('OPENAI_API_KEY');

const DEFAULT_BUCKET = 'polish-declension.firebasestorage.app';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_DURATION_SECONDS = 600;
const MAX_ITEMS_REGULAR = 1;
const MAX_TEXT_CHARS_USER = 2000;

const ttsClient = new TextToSpeechClient();
const AUDIO_CONFIG: protos.google.cloud.texttospeech.v1.IAudioConfig = {
  audioEncoding: 'MP3',
};
const TTS_VOICE = {
  languageCode: 'pl-PL',
  name: 'pl-PL-Wavenet-B',
};
const TTS_BYTE_LIMIT = 3500;

const ACCEPTED_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
]);

const ACCEPTED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
}

function isAcceptedAudio(contentType: string | undefined, fileName: string): boolean {
  if (contentType && ACCEPTED_CONTENT_TYPES.has(contentType)) return true;
  return ACCEPTED_EXTENSIONS.has(getExtension(fileName));
}

interface AudioItemData {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  duration: number;
  fileSize: number;
  storagePath: string;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  transcript: TranscriptSegment[];
  createdAt: number;
}

interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
}

interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { getAuth } = await import('firebase-admin/auth');
  try {
    const user = await getAuth().getUser(userId);
    return !!user.customClaims?.admin;
  } catch {
    return false;
  }
}

async function parseAudioDurationSeconds(
  buffer: Buffer,
  mimeType?: string
): Promise<number | null> {
  try {
    const { parseBuffer } = await import('music-metadata');
    const metadata = await parseBuffer(buffer, mimeType ? { mimeType } : undefined, {
      duration: true,
    });
    const duration = metadata.format.duration;
    return typeof duration === 'number' && Number.isFinite(duration) ? duration : null;
  } catch (error) {
    console.warn('Failed to parse audio duration from header:', error);
    return null;
  }
}

async function reserveUserAudioSlot(
  userId: string,
  audioRef: FirebaseFirestore.DocumentReference,
  data: AudioItemData,
  userIsAdmin: boolean
): Promise<void> {
  if (userIsAdmin) {
    await audioRef.set(data);
    return;
  }
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      db.collection('users').doc(userId).collection('audioItems').limit(MAX_ITEMS_REGULAR)
    );
    if (existing.size >= MAX_ITEMS_REGULAR) {
      throw new Error('Audio limit reached. Delete your existing audio to create a new one.');
    }
    tx.set(audioRef, data);
  });
}

function chunkTextForTTS(text: string): string[] {
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

export const processAudioUpload = onObjectFinalized(
  {
    bucket: DEFAULT_BUCKET,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const fileSize =
      typeof event.data.size === 'string' ? parseInt(event.data.size, 10) : event.data.size;

    const pathMatch = filePath.match(/^audio\/users\/([^/]+)\/pending\/([^/]+)\/(.+)$/);
    if (!pathMatch) return;

    const [, userId, audioId, fileName] = pathMatch;
    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);

    try {
      if (!isAcceptedAudio(contentType, fileName)) {
        throw new Error('Invalid file type. Supported: MP3, WAV, OGG, FLAC, M4A.');
      }

      const userIsAdmin = await isAdmin(userId);

      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      if (!userIsAdmin && fileSize > MAX_FILE_SIZE) {
        throw new Error('File too large. Maximum size is 25MB.');
      }

      const title = fileName.replace(/\.[^.]+$/, '');

      await reserveUserAudioSlot(
        userId,
        audioRef,
        {
          id: audioId,
          userId,
          title,
          fileName,
          duration: 0,
          fileSize,
          storagePath: '',
          status: 'processing',
          transcript: [],
          createdAt: Date.now(),
        },
        userIsAdmin
      );

      const queue = getFunctions().taskQueue('transcribeAudio');
      await queue.enqueue(
        { userId, audioId, fileName, bucket: event.data.bucket, filePath },
        { dispatchDeadlineSeconds: 600 }
      );

      console.log(`Enqueued transcription task for audio ${audioId} (user ${userId})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`Failed to process audio upload ${audioId}:`, error);

      await audioRef.set({
        id: audioId,
        userId,
        title: fileName.replace(/\.[^.]+$/, ''),
        fileName,
        duration: 0,
        fileSize,
        storagePath: '',
        status: 'error',
        error: errorMessage,
        transcript: [],
        createdAt: Date.now(),
      } satisfies AudioItemData);

      try {
        const bucket = storage.bucket(event.data.bucket);
        await bucket.file(filePath).delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
);

interface TranscribeTaskData {
  userId: string;
  audioId: string;
  fileName: string;
  bucket: string;
  filePath: string;
}

export const transcribeAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const {
      userId,
      audioId,
      fileName,
      bucket: bucketName,
      filePath,
    } = req.data as TranscribeTaskData;

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);

    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      const userIsAdmin = await isAdmin(userId);

      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      if (!userIsAdmin) {
        const headerDuration = await parseAudioDurationSeconds(
          buffer,
          typeof metadata.contentType === 'string' ? metadata.contentType : undefined
        );
        if (headerDuration === null) {
          throw new Error('Could not determine audio duration. File may be corrupt.');
        }
        if (headerDuration > MAX_DURATION_SECONDS) {
          throw new Error('Audio too long. Maximum duration is 10 minutes.');
        }
      }

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new Error('OpenAI API key not configured');

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

      if (!userIsAdmin && duration > MAX_DURATION_SECONDS) {
        throw new Error('Audio too long. Maximum duration is 10 minutes.');
      }

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
        const seg = segments.find(
          (s) => word.startTime >= s.startTime && word.startTime < s.endTime
        );
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

      const finalPath = `audio/users/${userId}/${audioId}/${fileName}`;
      await file.move(finalPath);

      await audioRef.update({
        duration,
        storagePath: finalPath,
        status: 'ready',
        transcript: segments,
      });

      console.log(
        `Transcription complete for audio ${audioId}: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      console.error(`Transcription failed for audio ${audioId}:`, error);

      await audioRef.update({
        status: 'error',
        error: errorMessage,
      });

      try {
        const bucket = storage.bucket(bucketName);
        await bucket.file(filePath).delete();
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }
);

interface DeleteAudioRequest {
  audioId: string;
}

export const deleteUserAudio = onCall<DeleteAudioRequest, Promise<{ success: boolean }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { audioId } = request.data;

    if (!audioId) {
      throw new HttpsError('invalid-argument', 'Audio ID required.');
    }

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);
    const audioDoc = await audioRef.get();

    if (!audioDoc.exists) {
      throw new HttpsError('not-found', 'Audio item not found.');
    }

    const audio = audioDoc.data() as AudioItemData;

    if (audio.userId !== userId) {
      throw new HttpsError('permission-denied', 'Not your audio item.');
    }

    if (audio.storagePath) {
      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(audio.storagePath).delete();
      } catch {
        // File might not exist
      }
    }

    await audioRef.delete();

    return { success: true };
  }
);

interface CreateUserAudioRequest {
  title: string;
  text: string;
}

export const createUserAudio = onCall<CreateUserAudioRequest, Promise<{ id: string }>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const userId = request.auth.uid;
    const { title, text } = request.data;

    if (!request.auth.token.admin) {
      await assertNotKilled('audio');
    }

    if (!title || typeof title !== 'string') {
      throw new HttpsError('invalid-argument', 'Title is required.');
    }
    if (!text || typeof text !== 'string' || text.length > MAX_TEXT_CHARS_USER) {
      throw new HttpsError(
        'invalid-argument',
        `Valid text required (max ${MAX_TEXT_CHARS_USER} chars).`
      );
    }

    const userIsAdmin = await isAdmin(userId);

    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc();
    const audioId = audioRef.id;

    try {
      await reserveUserAudioSlot(
        userId,
        audioRef,
        {
          id: audioId,
          userId,
          title,
          fileName: 'audio.mp3',
          duration: 0,
          fileSize: 0,
          storagePath: '',
          status: 'processing',
          transcript: [],
          createdAt: Date.now(),
        },
        userIsAdmin
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audio limit reached.';
      throw new HttpsError('resource-exhausted', message);
    }

    const queue = getFunctions().taskQueue('processUserTextAudio');
    await queue.enqueue({ userId, audioId, text }, { dispatchDeadlineSeconds: 600 });

    return { id: audioId };
  }
);

interface ProcessUserTextAudioTaskData {
  userId: string;
  audioId: string;
  text: string;
}

export const processUserTextAudio = onTaskDispatched(
  {
    secrets: [openaiApiKey],
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 2 },
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async (req) => {
    const { userId, audioId, text } = req.data as ProcessUserTextAudioTaskData;
    const audioRef = db.collection('users').doc(userId).collection('audioItems').doc(audioId);

    try {
      const userIsAdmin = await isAdmin(userId);
      if (!userIsAdmin && (await isKilled('audio'))) {
        throw new Error('Audio processing is temporarily unavailable.');
      }

      const chunks = chunkTextForTTS(text);
      const audioChunks: Buffer[] = [];

      for (const chunk of chunks) {
        const [ttsResponse] = await ttsClient.synthesizeSpeech({
          input: { text: chunk },
          voice: TTS_VOICE,
          audioConfig: AUDIO_CONFIG,
        });
        if (!ttsResponse.audioContent) throw new Error('TTS produced no audio.');
        audioChunks.push(Buffer.from(ttsResponse.audioContent as Uint8Array));
      }

      const audioBuffer = Buffer.concat(audioChunks);
      const finalPath = `audio/users/${userId}/${audioId}/audio.mp3`;
      const bucket = storage.bucket(DEFAULT_BUCKET);

      await bucket.file(finalPath).save(audioBuffer, {
        contentType: 'audio/mpeg',
      });

      const apiKey = openaiApiKey.value();
      if (!apiKey) throw new Error('OpenAI API key not configured.');

      const openai = new OpenAI({ apiKey });
      const audioFile = await toFile(audioBuffer, 'audio.mp3');

      const whisper = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
        language: 'pl',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const duration = whisper.duration ?? 0;

      const segments: TranscriptSegment[] = (whisper.segments ?? []).map((seg) => ({
        text: seg.text.trim(),
        startTime: seg.start,
        endTime: seg.end,
        words: [],
      }));

      const words: TranscriptWord[] = (whisper.words ?? []).map((w) => ({
        word: w.word,
        startTime: w.start,
        endTime: w.end,
        confidence: 1,
      }));

      for (const word of words) {
        const seg = segments.find(
          (s) => word.startTime >= s.startTime && word.startTime < s.endTime
        );
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

      await audioRef.update({
        fileSize: audioBuffer.length,
        duration,
        storagePath: finalPath,
        status: 'ready',
        transcript: segments,
      });

      console.log(
        `User text audio ${audioId} ready: ${segments.length} segments, ${words.length} words, ${duration}s`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error(`User text audio processing failed for ${audioId}:`, error);

      await audioRef.update({ status: 'error', error: errorMessage });

      try {
        const bucket = storage.bucket(DEFAULT_BUCKET);
        await bucket.file(`audio/users/${userId}/${audioId}/audio.mp3`).delete();
      } catch {
        // File might not exist yet
      }

      throw error;
    }
  }
);

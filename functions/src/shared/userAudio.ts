import { db } from './firebase.js';

export const MAX_FILE_SIZE_USER_AUDIO = 25 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 600;
export const MAX_ITEMS_REGULAR = 1;
export const MAX_TEXT_CHARS_USER = 2000;

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

export function isAcceptedAudio(contentType: string | undefined, fileName: string): boolean {
  if (contentType && ACCEPTED_CONTENT_TYPES.has(contentType)) return true;
  return ACCEPTED_EXTENSIONS.has(getExtension(fileName));
}

import type { TranscriptSegment } from './transcription.js';

export interface AudioItemData {
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

export async function parseAudioDurationSeconds(
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

export async function reserveUserAudioSlot(
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

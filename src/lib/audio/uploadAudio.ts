import { getCurrentUserId } from '../cachedAuth';
import { uploadPendingAndAwait } from '../media/storageFiles';
import { cacheAudioBlob } from './audioCache';
import type { UploadProgress } from '../media/storageFiles';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PROCESSING_TIMEOUT = 10 * 60 * 1000;

const ACCEPTED_TYPES = new Set([
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

function isAcceptedAudio(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  return ACCEPTED_EXTENSIONS.has(getExtension(file.name));
}

export async function uploadAudio(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 25MB.');
  }

  if (!isAcceptedAudio(file)) {
    throw new Error('Unsupported format. Use MP3, WAV, OGG, FLAC, or M4A.');
  }

  return uploadPendingAndAwait({
    file,
    pendingFolder: `audio/users/${userId}/pending`,
    itemCollection: ['users', userId, 'audioItems'],
    timeoutMs: PROCESSING_TIMEOUT,
    onProgress,
    onUploaded: (audioId) => {
      cacheAudioBlob(audioId, file).catch(() => {});
    },
  });
}

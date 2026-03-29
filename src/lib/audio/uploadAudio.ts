import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { getUserId } from '../storage/helpers';
import { cacheAudioBlob } from './audioCache';
import type { AudioUploadProgress, AudioItem } from '../../types/audio';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

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
  onProgress: (progress: AudioUploadProgress) => void
): Promise<string> {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 25MB.');
  }

  if (!isAcceptedAudio(file)) {
    throw new Error('Unsupported format. Use MP3, WAV, OGG, FLAC, or M4A.');
  }

  const audioId = crypto.randomUUID();
  const storagePath = `audio/users/${userId}/pending/${audioId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress({ status: 'uploading', uploadPercent: percent, audioId });
      },
      (error) => {
        onProgress({ status: 'error', error: error.message, audioId });
        reject(error);
      },
      () => {
        onProgress({ status: 'processing', audioId });
        cacheAudioBlob(audioId, file).catch(() => {});

        const audioRef = doc(db, 'users', userId, 'audioItems', audioId);
        const unsubscribe = onSnapshot(audioRef, (snapshot) => {
          if (!snapshot.exists()) return;

          const data = snapshot.data() as AudioItem;

          if (data.status === 'ready') {
            unsubscribe();
            onProgress({ status: 'ready', audioId });
            resolve(audioId);
          } else if (data.status === 'error') {
            unsubscribe();
            onProgress({ status: 'error', error: data.error, audioId });
            reject(new Error(data.error));
          }
        });

        setTimeout(
          () => {
            unsubscribe();
            reject(new Error('Processing timed out. Please try again.'));
          },
          10 * 60 * 1000
        );
      }
    );
  });
}

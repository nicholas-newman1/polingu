import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { getCurrentUserId } from '../cachedAuth';
import { cachedCollection } from '../media/cachedCollection';
import { getStorageDownloadUrl } from '../media/storageFiles';
import { removeCachedAudioBlob } from './audioCache';
import type { AudioItem } from '../../types/audio';

const audioItems = cachedCollection<AudioItem>({
  cacheKey: '__audio-items-list',
  path: () => {
    const userId = getCurrentUserId();
    return userId ? ['users', userId, 'audioItems'] : null;
  },
  newestFirstBy: 'createdAt',
  label: 'Audio items',
});

export const getCachedAudioItems = audioItems.getCached;
export const subscribeToAudioItemsUpdates = audioItems.subscribe;
export const subscribeToAudioItem = audioItems.subscribeOne;
export const getAudioDownloadUrl = getStorageDownloadUrl;

export async function deleteUserAudio(audioId: string): Promise<void> {
  const deleteFn = httpsCallable<{ audioId: string }, { success: boolean }>(
    functions,
    'deleteUserAudio'
  );
  await deleteFn({ audioId });
  await removeCachedAudioBlob(audioId);
}

export async function createUserAudio(data: { title: string; text: string }): Promise<string> {
  const createFn = httpsCallable<{ title: string; text: string }, { id: string }>(
    functions,
    'createUserAudio'
  );
  const result = await createFn(data);
  return result.data.id;
}

export async function updateUserAudio(audioId: string, updates: { title?: string }): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  const audioRef = doc(db, 'users', userId, 'audioItems', audioId);

  const cleanUpdates: Record<string, string> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();

  await updateDoc(audioRef, cleanUpdates);
}

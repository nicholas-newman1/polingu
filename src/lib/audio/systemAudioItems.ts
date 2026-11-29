import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { cachedCollection } from '../media/cachedCollection';
import type { SystemAudioItem, TranscriptSegment } from '../../types/audio';

const systemAudioItems = cachedCollection<SystemAudioItem>({
  cacheKey: '__system-audio-items-list',
  path: () => ['systemAudioItems'],
  newestFirstBy: 'createdAt',
  label: 'System audio items',
});

export const getCachedSystemAudioItems = systemAudioItems.getCached;
export const subscribeToSystemAudioItems = systemAudioItems.subscribe;
export const subscribeToSystemAudioItem = systemAudioItems.subscribeOne;

const createFn = httpsCallable<{ title: string; text: string }, { id: string }>(
  functions,
  'createSystemAudio'
);

export async function createSystemAudio(data: { title: string; text: string }): Promise<string> {
  const result = await createFn(data);
  return result.data.id;
}

const deleteFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteSystemAudio'
);

export async function deleteSystemAudio(id: string): Promise<void> {
  await deleteFn({ id });
}

export async function updateSystemAudio(
  id: string,
  updates: { title?: string; transcript?: TranscriptSegment[] }
): Promise<void> {
  const audioRef = doc(db, 'systemAudioItems', id);
  const cleanUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  if (updates.transcript !== undefined) cleanUpdates.transcript = updates.transcript;
  await updateDoc(audioRef, cleanUpdates);
}

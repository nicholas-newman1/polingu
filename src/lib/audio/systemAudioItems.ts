import { collection, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { userDb } from '../offlineDb/userDb';
import type { SystemAudioItem } from '../../types/audio';

const SYSTEM_AUDIO_ITEMS_CACHE_KEY = '__system-audio-items-list';

export async function getCachedSystemAudioItems(): Promise<SystemAudioItem[]> {
  const record = await userDb.userData.get(SYSTEM_AUDIO_ITEMS_CACHE_KEY);
  return record ? (record.data as SystemAudioItem[]) : [];
}

async function cacheSystemAudioItems(items: SystemAudioItem[]): Promise<void> {
  await userDb.userData.put({
    key: SYSTEM_AUDIO_ITEMS_CACHE_KEY,
    data: items,
    lastModified: Date.now(),
    pendingSync: 0,
  });
}

export function subscribeToSystemAudioItems(
  callback: (items: SystemAudioItem[]) => void
): () => void {
  const itemsRef = collection(db, 'systemAudioItems');
  const q = query(itemsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as SystemAudioItem);
      cacheSystemAudioItems(items);
      callback(items);
    },
    (error) => {
      console.error('System audio items subscription error:', error);
    }
  );
}

export function subscribeToSystemAudioItem(
  audioId: string,
  callback: (item: SystemAudioItem | null) => void
): () => void {
  const audioRef = doc(db, 'systemAudioItems', audioId);
  return onSnapshot(audioRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.data() as SystemAudioItem);
  });
}

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
  updates: { title?: string }
): Promise<void> {
  const audioRef = doc(db, 'systemAudioItems', id);
  const cleanUpdates: Record<string, string> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  await updateDoc(audioRef, cleanUpdates);
}

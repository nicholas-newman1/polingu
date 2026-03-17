import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, functions, storage } from '../firebase';
import { getUserId } from '../storage/helpers';
import type { AudioItem } from '../../types/audio';

export async function getAudioItems(): Promise<AudioItem[]> {
  const userId = getUserId();
  if (!userId) return [];

  const itemsRef = collection(db, 'users', userId, 'audioItems');
  const q = query(itemsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as AudioItem);
}

export function subscribeToAudioItemsUpdates(
  callback: (items: AudioItem[]) => void
): () => void {
  const userId = getUserId();
  if (!userId) return () => {};

  const itemsRef = collection(db, 'users', userId, 'audioItems');
  const q = query(itemsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => doc.data() as AudioItem);
    callback(items);
  });
}

export async function getAudioItem(audioId: string): Promise<AudioItem | null> {
  const userId = getUserId();
  if (!userId) return null;

  const audioRef = doc(db, 'users', userId, 'audioItems', audioId);
  const audioDoc = await getDoc(audioRef);

  if (!audioDoc.exists()) return null;
  return audioDoc.data() as AudioItem;
}

export function subscribeToAudioItem(
  audioId: string,
  callback: (item: AudioItem | null) => void
): () => void {
  const userId = getUserId();
  if (!userId) return () => {};

  const audioRef = doc(db, 'users', userId, 'audioItems', audioId);

  return onSnapshot(audioRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.data() as AudioItem);
  });
}

export async function getAudioDownloadUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
}

export async function deleteAudioItem(audioId: string): Promise<void> {
  const deleteFn = httpsCallable<{ audioId: string }, { success: boolean }>(
    functions,
    'deleteAudioItem'
  );
  await deleteFn({ audioId });
}

export async function updateAudioItem(
  audioId: string,
  updates: { title?: string }
): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');

  const audioRef = doc(db, 'users', userId, 'audioItems', audioId);

  const cleanUpdates: Record<string, string> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();

  await updateDoc(audioRef, cleanUpdates);
}

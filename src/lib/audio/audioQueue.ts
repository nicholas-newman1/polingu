import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserId } from '../storage/helpers';
import type { AudioQueue } from '../../types/audio';

function getQueueDocRef() {
  const userId = getUserId();
  if (!userId) return null;
  return doc(db, 'users', userId, 'audioQueue', 'current');
}

export async function getAudioQueue(): Promise<AudioQueue | null> {
  const ref = getQueueDocRef();
  if (!ref) return null;

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data() as AudioQueue;
}

export async function saveAudioQueue(queue: AudioQueue): Promise<void> {
  const ref = getQueueDocRef();
  if (!ref) return;
  await setDoc(ref, queue);
}

export async function updateQueueSavedTime(time: number): Promise<void> {
  const ref = getQueueDocRef();
  if (!ref) return;
  await updateDoc(ref, { savedTime: time });
}

export function subscribeToAudioQueue(
  callback: (queue: AudioQueue | null) => void
): () => void {
  const ref = getQueueDocRef();
  if (!ref) return () => {};

  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.data() as AudioQueue);
  });
}

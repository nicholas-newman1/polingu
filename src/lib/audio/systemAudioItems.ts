import { collection, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import type { SystemAudioItem } from '../../types/audio';

export const POLISH_WAVENET_SYSTEM_AUDIO_VOICES = [
  { value: 'pl-PL-Wavenet-A', label: 'Wavenet A' },
  { value: 'pl-PL-Wavenet-B', label: 'Wavenet B' },
  { value: 'pl-PL-Wavenet-C', label: 'Wavenet C' },
  { value: 'pl-PL-Wavenet-D', label: 'Wavenet D' },
  { value: 'pl-PL-Wavenet-E', label: 'Wavenet E' },
] as const;

export type PolishWavenetSystemAudioVoice =
  (typeof POLISH_WAVENET_SYSTEM_AUDIO_VOICES)[number]['value'];

export const DEFAULT_SYSTEM_AUDIO_VOICE: PolishWavenetSystemAudioVoice = 'pl-PL-Wavenet-B';

export function subscribeToSystemAudioItems(
  callback: (items: SystemAudioItem[]) => void
): () => void {
  const itemsRef = collection(db, 'systemAudioItems');
  const q = query(itemsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as SystemAudioItem);
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

const createFn = httpsCallable<{ title: string; text: string; voiceName?: string }, { id: string }>(
  functions,
  'createSystemAudio'
);

export async function createSystemAudio(data: {
  title: string;
  text: string;
  voiceName?: string;
}): Promise<string> {
  const result = await createFn(data);
  return result.data.id;
}

const deleteFn = httpsCallable<{ id: string }, { success: boolean }>(
  functions,
  'deleteSystemAudio'
);

export async function deleteSystemAudioItem(id: string): Promise<void> {
  await deleteFn({ id });
}

export async function updateSystemAudioItem(
  id: string,
  updates: { title?: string }
): Promise<void> {
  const audioRef = doc(db, 'systemAudioItems', id);
  const cleanUpdates: Record<string, string> = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  await updateDoc(audioRef, cleanUpdates);
}

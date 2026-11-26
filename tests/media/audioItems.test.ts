import { Blob as NodeBlob } from 'node:buffer';
import { describe, expect, test, vi } from 'vitest';
import {
  cacheAudioBlob,
  createUserAudio,
  deleteUserAudio,
  getAudioDownloadUrl,
  getCachedAudioBlob,
  getCachedAudioItems,
  subscribeToAudioItem,
  subscribeToAudioItemsUpdates,
  updateUserAudio,
} from '../../src/lib/audio';
import type { AudioItem } from '../../src/types/audio';
import { remote } from './support/fakeFirestore';
import { server } from './support/fakeFunctions';
import { bucket, downloadUrlFor } from './support/fakeStorage';
import { flushMicrotasks, setupMediaTests, settle, signIn, userPath } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
vi.mock('firebase/storage', () => import('./support/fakeStorage'));
vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

setupMediaTests();

const UID = 'learner-a';
const itemPath = (id: string, uid = UID) => userPath(uid, 'audioItems', id);

const item = (id: string, overrides: Partial<AudioItem> = {}): AudioItem => ({
  id,
  userId: UID,
  title: `Title ${id}`,
  fileName: `${id}.mp3`,
  duration: 60,
  fileSize: 1000,
  storagePath: `audio/users/${UID}/${id}.mp3`,
  status: 'ready',
  transcript: [],
  createdAt: 0,
  ...overrides,
});

/** Subscribes and returns every list delivered, as arrays of ids. */
function watchList() {
  const lists: string[][] = [];
  const unsubscribe = subscribeToAudioItemsUpdates((items) => lists.push(items.map((i) => i.id)));
  return { lists, unsubscribe };
}

describe('the user’s audio library', () => {
  test('is empty offline before it has ever loaded', async () => {
    signIn(UID);
    expect(await getCachedAudioItems()).toEqual([]);
  });

  test('lists the user’s items newest first and keeps a copy for offline use', async () => {
    signIn(UID);
    remote.seed(itemPath('old'), item('old', { createdAt: 100 }));
    remote.seed(itemPath('newest'), item('newest', { createdAt: 300 }));
    remote.seed(itemPath('middle'), item('middle', { createdAt: 200 }));

    const { lists } = watchList();
    await flushMicrotasks();

    expect(lists).toEqual([['newest', 'middle', 'old']]);
    await settle();
    expect((await getCachedAudioItems()).map((i) => i.id)).toEqual(['newest', 'middle', 'old']);
    expect((await getCachedAudioItems())[0]).toEqual(item('newest', { createdAt: 300 }));
  });

  test('delivers later changes, and the offline copy follows them', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a', { createdAt: 1 }));
    const { lists } = watchList();
    await flushMicrotasks();

    remote.seed(itemPath('b'), item('b', { createdAt: 2, status: 'processing' }));
    await flushMicrotasks();
    remote.remove(itemPath('a'));
    await flushMicrotasks();

    expect(lists).toEqual([['a'], ['b', 'a'], ['b']]);
    await settle();
    expect((await getCachedAudioItems()).map((i) => i.id)).toEqual(['b']);
  });

  test('does not include other users’ items', async () => {
    signIn(UID);
    remote.seed(itemPath('mine'), item('mine'));
    remote.seed(itemPath('theirs', 'learner-b'), item('theirs', { userId: 'learner-b' }));

    const { lists } = watchList();
    await flushMicrotasks();

    expect(lists).toEqual([['mine']]);
  });

  test('stops delivering changes after unsubscribing', async () => {
    signIn(UID);
    const { lists, unsubscribe } = watchList();
    await flushMicrotasks();

    unsubscribe();
    remote.seed(itemPath('late'), item('late'));
    await flushMicrotasks();

    expect(lists).toEqual([[]]);
  });

  test('does nothing while signed out', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToAudioItemsUpdates(callback);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(remote.calls).toEqual([]);
    expect(() => unsubscribe()).not.toThrow();
  });

  test('a failed subscription is logged and leaves the offline copy alone', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a'));
    const first = watchList();
    await flushMicrotasks();
    first.unsubscribe();
    await settle();
    remote.fail({ op: 'onSnapshot' });

    const { lists } = watchList();
    await flushMicrotasks();

    expect(lists).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      'Audio items subscription error:',
      expect.objectContaining({ code: 'permission-denied' })
    );
    expect((await getCachedAudioItems()).map((i) => i.id)).toEqual(['a']);
  });
});

describe('a single audio item', () => {
  test('is reported, then reported again when it changes', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a', { status: 'processing' }));
    const seen: Array<AudioItem | null> = [];
    subscribeToAudioItem('a', (i) => seen.push(i));
    await flushMicrotasks();

    remote.seed(itemPath('a'), item('a', { status: 'ready', duration: 42 }));
    await flushMicrotasks();

    expect(seen).toEqual([
      item('a', { status: 'processing' }),
      item('a', { status: 'ready', duration: 42 }),
    ]);
  });

  test('is reported as null when it does not exist or is deleted', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a'));
    const deleted: Array<string | null> = [];
    const missing: Array<string | null> = [];
    subscribeToAudioItem('a', (i) => deleted.push(i?.id ?? null));
    subscribeToAudioItem('missing', (i) => missing.push(i?.id ?? null));
    await flushMicrotasks();

    remote.remove(itemPath('a'));
    await flushMicrotasks();

    expect(deleted).toEqual(['a', null]);
    expect(missing).toEqual([null]);
  });

  test('stops being reported after unsubscribing', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a', { status: 'processing' }));
    const seen: Array<string | undefined> = [];
    const unsubscribe = subscribeToAudioItem('a', (i) => seen.push(i?.status));
    await flushMicrotasks();

    unsubscribe();
    remote.seed(itemPath('a'), item('a', { status: 'ready' }));
    await flushMicrotasks();

    expect(seen).toEqual(['processing']);
    expect(remote.listenerCount).toBe(0);
  });

  test('is read from the signed-in user’s own items only', async () => {
    signIn(UID);
    remote.seed(itemPath('a', 'learner-b'), item('a', { userId: 'learner-b' }));
    const seen: Array<AudioItem | null> = [];
    subscribeToAudioItem('a', (i) => seen.push(i));
    await flushMicrotasks();

    expect(seen).toEqual([null]);
  });

  test('is not watched while signed out', async () => {
    remote.seed(itemPath('a'), item('a'));
    const callback = vi.fn();
    const unsubscribe = subscribeToAudioItem('a', callback);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(remote.calls).toEqual([]);
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('playing a stored file', () => {
  test('resolves the download URL of the stored file', async () => {
    bucket.files.add('audio/users/learner-a/a.mp3');

    expect(await getAudioDownloadUrl('audio/users/learner-a/a.mp3')).toBe(
      downloadUrlFor('audio/users/learner-a/a.mp3')
    );
  });

  test('rejects when the file is not in Storage', async () => {
    await expect(getAudioDownloadUrl('audio/users/learner-a/gone.mp3')).rejects.toMatchObject({
      code: 'storage/object-not-found',
    });
  });
});

describe('creating, renaming and deleting', () => {
  test('creating generated audio sends the title and text to the server and returns the new id', async () => {
    signIn(UID);
    server.handle('createUserAudio', () => ({ id: 'new-1' }));

    expect(await createUserAudio({ title: 'Dialog', text: 'Dzień dobry.' })).toBe('new-1');
    expect(server.callsTo('createUserAudio')).toEqual([{ title: 'Dialog', text: 'Dzień dobry.' }]);
  });

  test('renaming trims the title and leaves the rest of the item unchanged', async () => {
    signIn(UID);
    remote.seed(itemPath('a'), item('a', { title: 'Old' }));

    await updateUserAudio('a', { title: '  New title  ' });

    expect(remote.get(itemPath('a'))).toEqual(item('a', { title: 'New title' }));
  });

  test('renaming requires a signed-in user', async () => {
    await expect(updateUserAudio('a', { title: 'x' })).rejects.toThrow('Not authenticated');
    expect(remote.calls).toEqual([]);
  });

  test('deleting asks the server to delete the item', async () => {
    signIn(UID);
    server.handle('deleteUserAudio', () => ({ success: true }));

    await deleteUserAudio('a');

    expect(server.callsTo('deleteUserAudio')).toEqual([{ audioId: 'a' }]);
  });

  test('a failed delete rejects so the caller can report it', async () => {
    signIn(UID);
    server.handle('deleteUserAudio', () => {
      throw new Error('Audio item not found.');
    });

    await expect(deleteUserAudio('a')).rejects.toThrow('Audio item not found.');
  });

  test('deleting an item also drops its locally cached audio', async () => {
    signIn(UID);
    server.handle('deleteUserAudio', () => ({ success: true }));
    await cacheAudioBlob('a', new NodeBlob(['audio']) as unknown as Blob);

    await deleteUserAudio('a');

    expect(await getCachedAudioBlob('a')).toBeNull();
  });
});

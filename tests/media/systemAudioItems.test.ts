import { describe, expect, test, vi } from 'vitest';
import {
  createSystemAudio,
  deleteSystemAudio,
  getCachedAudioItems,
  getCachedSystemAudioItems,
  subscribeToSystemAudioItem,
  subscribeToSystemAudioItems,
  updateSystemAudio,
} from '../../src/lib/audio';
import type { SystemAudioItem, TranscriptSegment } from '../../src/types/audio';
import { remote } from './support/fakeFirestore';
import { server } from './support/fakeFunctions';
import { flushMicrotasks, setupMediaTests, settle, signIn } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
vi.mock('firebase/storage', () => import('./support/fakeStorage'));
vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

setupMediaTests();

const path = (id: string) => `systemAudioItems/${id}`;

const segment = (text: string, startTime: number): TranscriptSegment => ({
  text,
  startTime,
  endTime: startTime + 1,
  words: [],
});

const item = (id: string, overrides: Partial<SystemAudioItem> = {}): SystemAudioItem => ({
  id,
  title: `Title ${id}`,
  text: `Text ${id}`,
  storagePath: `audio/system/${id}.mp3`,
  duration: 30,
  status: 'ready',
  transcript: [segment('Cześć', 0)],
  createdAt: 0,
  ...overrides,
});

describe('built-in audio library', () => {
  test('lists items newest first, even when signed out, and keeps a copy for offline use', async () => {
    remote.seed(path('a'), item('a', { createdAt: 1 }));
    remote.seed(path('c'), item('c', { createdAt: 3 }));
    remote.seed(path('b'), item('b', { createdAt: 2 }));
    const lists: string[][] = [];

    subscribeToSystemAudioItems((items) => lists.push(items.map((i) => i.id)));
    await flushMicrotasks();
    await settle();

    expect(lists).toEqual([['c', 'b', 'a']]);
    expect(await getCachedSystemAudioItems()).toEqual([
      item('c', { createdAt: 3 }),
      item('b', { createdAt: 2 }),
      item('a', { createdAt: 1 }),
    ]);
  });

  test('is cached separately from the user’s own audio', async () => {
    signIn('learner-a');
    remote.seed(path('a'), item('a'));

    subscribeToSystemAudioItems(() => {});
    await flushMicrotasks();
    await settle();

    expect((await getCachedSystemAudioItems()).map((i) => i.id)).toEqual(['a']);
    expect(await getCachedAudioItems()).toEqual([]);
  });

  test('is empty offline before it has ever loaded', async () => {
    expect(await getCachedSystemAudioItems()).toEqual([]);
  });

  test('a failed subscription is logged and delivers nothing', async () => {
    remote.fail({ op: 'onSnapshot' });
    const callback = vi.fn();

    subscribeToSystemAudioItems(callback);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'System audio items subscription error:',
      expect.objectContaining({ code: 'permission-denied' })
    );
  });

  test('a single item is reported with its changes, and as null once deleted', async () => {
    remote.seed(path('a'), item('a', { status: 'processing' }));
    const seen: Array<SystemAudioItem | null> = [];
    const unsubscribe = subscribeToSystemAudioItem('a', (i) => seen.push(i));
    await flushMicrotasks();

    remote.seed(path('a'), item('a'));
    await flushMicrotasks();
    remote.remove(path('a'));
    await flushMicrotasks();
    unsubscribe();
    remote.seed(path('a'), item('a', { title: 'after unsubscribe' }));
    await flushMicrotasks();

    expect(seen).toEqual([item('a', { status: 'processing' }), item('a'), null]);
  });
});

describe('managing built-in audio', () => {
  test('creating sends the title and text to the server and returns the new id', async () => {
    server.handle('createSystemAudio', () => ({ id: 'sys-9' }));

    expect(await createSystemAudio({ title: 'Na poczcie', text: 'Poproszę znaczek.' })).toBe(
      'sys-9'
    );
    expect(server.callsTo('createSystemAudio')).toEqual([
      { title: 'Na poczcie', text: 'Poproszę znaczek.' },
    ]);
  });

  test('deleting asks the server to delete that item, and a failure rejects', async () => {
    server.handle('deleteSystemAudio', () => ({ success: true }));
    await deleteSystemAudio('sys-1');
    expect(server.callsTo('deleteSystemAudio')).toEqual([{ id: 'sys-1' }]);

    server.handle('deleteSystemAudio', () => {
      throw new Error('permission-denied');
    });
    await expect(deleteSystemAudio('sys-2')).rejects.toThrow('permission-denied');
  });

  test('editing trims the title and replaces the transcript, leaving other fields alone', async () => {
    remote.seed(path('a'), item('a'));
    const transcript = [segment('Dzień dobry', 0), segment('Do widzenia', 2)];

    await updateSystemAudio('a', { title: '  Powitanie ', transcript });

    expect(remote.get(path('a'))).toEqual(item('a', { title: 'Powitanie', transcript }));
  });

  test('editing only the title keeps the existing transcript', async () => {
    remote.seed(path('a'), item('a'));

    await updateSystemAudio('a', { title: 'Renamed' });

    expect(remote.get(path('a'))).toEqual(item('a', { title: 'Renamed' }));
  });

  test('editing only the transcript keeps the existing title', async () => {
    remote.seed(path('a'), item('a', { title: 'Powitanie' }));
    const transcript = [segment('Dzień dobry!', 0)];

    await updateSystemAudio('a', { transcript });

    expect(remote.get(path('a'))).toEqual(item('a', { title: 'Powitanie', transcript }));
  });
});

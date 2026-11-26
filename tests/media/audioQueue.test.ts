import { describe, expect, test, vi } from 'vitest';
import { getAudioQueue, saveAudioQueue, updateQueueSavedTime } from '../../src/lib/audio';
import type { AudioQueue } from '../../src/types/audio';
import { freezeTime } from '../sync/support/harness';
import { remote } from './support/fakeFirestore';
import { setupMediaTests, signIn, userPath } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupMediaTests();

const UID = 'learner-a';
const queuePath = userPath(UID, 'audioQueue', 'current');

const queue = (overrides: Partial<AudioQueue> = {}): AudioQueue => ({
  currentTrackId: 't1',
  userQueue: ['t2'],
  autoQueue: ['t3', 't4'],
  history: ['t0'],
  savedTime: 12.5,
  updatedAt: 1000,
  ...overrides,
});

describe('the listening queue', () => {
  test('is null before one has been saved', async () => {
    signIn(UID);
    expect(await getAudioQueue()).toBeNull();
  });

  test('is saved to the user’s account and read back', async () => {
    signIn(UID);

    await saveAudioQueue(queue());

    expect(remote.get(queuePath)).toEqual(queue());
    expect(await getAudioQueue()).toEqual(queue());
  });

  test('saving replaces the previous queue entirely', async () => {
    signIn(UID);
    await saveAudioQueue(queue());

    await saveAudioQueue(queue({ currentTrackId: null, userQueue: [], autoQueue: [] }));

    expect(await getAudioQueue()).toEqual(
      queue({ currentTrackId: null, userQueue: [], autoQueue: [] })
    );
  });

  test('updating the playback position changes only the saved time and its timestamp', async () => {
    freezeTime('2026-11-26T20:00:00Z');
    signIn(UID);
    await saveAudioQueue(queue());

    await updateQueueSavedTime(95.25);

    expect(await getAudioQueue()).toEqual(
      queue({ savedTime: 95.25, updatedAt: Date.parse('2026-11-26T20:00:00Z') })
    );
  });

  test('is neither read nor written while signed out', async () => {
    remote.seed(queuePath, queue());

    expect(await getAudioQueue()).toBeNull();
    await saveAudioQueue(queue({ savedTime: 1 }));
    await updateQueueSavedTime(2);

    expect(remote.calls).toEqual([]);
    expect(remote.get(queuePath)).toEqual(queue());
  });
});

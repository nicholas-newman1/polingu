import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getAudioQueue, saveAudioQueue, updateQueueSavedTime } from '../../src/lib/audio';
import { useQueueManager } from '../../src/hooks/useQueueManager';
import type { AudioQueue } from '../../src/types/audio';
import { deferred } from './support/deferred';

// The queue is stored in Firestore through these three functions.
vi.mock('../../src/lib/audio', () => ({
  getAudioQueue: vi.fn(),
  saveAudioQueue: vi.fn(),
  updateQueueSavedTime: vi.fn(),
}));

const LOCAL_KEY = 'polingu.audioSavedTime';
const NOW = new Date('2026-03-10T20:00:00').getTime();

const savedQueue = (overrides: Partial<AudioQueue> = {}): AudioQueue => ({
  currentTrackId: 't2',
  userQueue: ['u1'],
  autoQueue: ['a1', 'a2'],
  history: ['t1'],
  savedTime: 42,
  updatedAt: NOW - 60_000,
  ...overrides,
});

const setLocalTime = (trackId: string, time: number, updatedAt: number) =>
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ trackId, time, updatedAt }));
const localTime = () => JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null');

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(getAudioQueue).mockResolvedValue(null);
  vi.mocked(saveAudioQueue).mockResolvedValue();
  vi.mocked(updateQueueSavedTime).mockResolvedValue();
});

async function renderQueue() {
  const hook = renderHook(() => useQueueManager());
  await act(async () => {});
  const queue = () => hook.result.current;
  /** Runs a queue action inside act and returns its result. */
  const run = <T>(fn: () => T): T => {
    let out!: T;
    act(() => {
      out = fn();
    });
    return out;
  };
  return { ...hook, queue, run };
}

/** A queue started at `start` within `tracks`, with nothing loaded from storage. */
async function startedQueue(tracks: string[], start = 0) {
  const h = await renderQueue();
  h.run(() => h.queue().initializeQueue(tracks, start));
  return h;
}

const lastSavedQueue = () => vi.mocked(saveAudioQueue).mock.calls.at(-1)?.[0];

describe('restoring the queue', () => {
  test('restores the saved queue and playback position on start', async () => {
    vi.mocked(getAudioQueue).mockResolvedValue(savedQueue());
    const { queue } = await renderQueue();

    expect(queue()).toMatchObject({
      currentTrackId: 't2',
      userQueue: ['u1'],
      autoQueue: ['a1', 'a2'],
      hasNext: true,
      hasPrevious: true,
      previousTrackId: 't1',
      initialSavedTime: 42,
    });
    expect(saveAudioQueue).not.toHaveBeenCalled();
  });

  test('prefers a newer position saved on this device for the same track', async () => {
    vi.mocked(getAudioQueue).mockResolvedValue(savedQueue());
    setLocalTime('t2', 57, NOW - 1000);
    const { queue } = await renderQueue();
    expect(queue().initialSavedTime).toBe(57);
  });

  test.each([
    ['older than the server copy', () => setLocalTime('t2', 57, NOW - 120_000)],
    ['for a different track', () => setLocalTime('t9', 57, NOW - 1000)],
    ['unreadable', () => localStorage.setItem(LOCAL_KEY, '{not json')],
    ['missing fields', () => localStorage.setItem(LOCAL_KEY, JSON.stringify({ time: 57 }))],
  ])('ignores a device position that is %s', async (_, setUp) => {
    vi.mocked(getAudioQueue).mockResolvedValue(savedQueue());
    setUp();
    const { queue } = await renderQueue();
    expect(queue().initialSavedTime).toBe(42);
  });

  test('stays empty when there is no saved queue or loading it fails', async () => {
    vi.mocked(getAudioQueue).mockRejectedValueOnce(new Error('offline'));
    const failed = await renderQueue();
    expect(failed.queue()).toMatchObject({ currentTrackId: null, hasNext: false });

    vi.mocked(getAudioQueue).mockResolvedValueOnce(savedQueue({ userQueue: undefined }));
    const malformed = await renderQueue();
    expect(malformed.queue().currentTrackId).toBeNull();
  });

  test('a queue started before the saved one finishes loading is kept', async () => {
    const load = deferred<AudioQueue | null>();
    vi.mocked(getAudioQueue).mockReturnValue(load.promise);
    const h = renderHook(() => useQueueManager());
    act(() => h.result.current.initializeQueue(['n1', 'n2'], 0));

    await act(async () => load.resolve(savedQueue()));

    expect(h.result.current.currentTrackId).toBe('n1');
    expect(h.result.current.autoQueue).toEqual(['n2']);
  });
});

describe('moving through the queue', () => {
  test('starting from a track queues the ones after it and saves the queue at position 0', async () => {
    const { queue } = await startedQueue(['a', 'b', 'c', 'd'], 1);
    expect(queue()).toMatchObject({
      currentTrackId: 'b',
      userQueue: [],
      autoQueue: ['c', 'd'],
      hasPrevious: false,
    });
    expect(lastSavedQueue()).toEqual({
      currentTrackId: 'b',
      userQueue: [],
      autoQueue: ['c', 'd'],
      history: [],
      savedTime: 0,
      updatedAt: NOW,
    });
  });

  test('tracks the user queued play before the automatic queue, and play-next jumps the line', async () => {
    const { queue, run } = await startedQueue(['a', 'b', 'c']);
    run(() => queue().addToQueue('x'));
    run(() => queue().insertNext('y'));
    expect(queue().userQueue).toEqual(['y', 'x']);

    const played = [1, 2, 3, 4].map(() => run(() => queue().advanceQueue()));
    expect(played).toEqual(['y', 'x', 'b', 'c']);
    expect(queue().previousTrackId).toBe('b');
  });

  test('going back returns to the previous track and plays the current one next', async () => {
    const { queue, run } = await startedQueue(['a', 'b', 'c']);
    run(() => queue().advanceQueue());
    expect(run(() => queue().rewindQueue())).toBe('a');
    expect(queue()).toMatchObject({ currentTrackId: 'a', userQueue: ['b'], autoQueue: ['c'] });
    expect(run(() => queue().advanceQueue())).toBe('b');
    expect(run(() => queue().advanceQueue())).toBe('c');
  });

  test('advancing past the end or rewinding past the start keeps the current track', async () => {
    const { queue, run } = await startedQueue(['a']);
    expect(run(() => queue().rewindQueue())).toBeNull();
    expect(run(() => queue().advanceQueue())).toBeNull();
    expect(queue().currentTrackId).toBe('a');
    expect(queue().hasNext).toBe(false);
  });

  test('skipping ahead in the automatic queue sends skipped and user-queued tracks to history', async () => {
    const { queue, run } = await startedQueue(['a', 'b', 'c', 'd', 'e']);
    run(() => queue().addToQueue('u'));

    expect(run(() => queue().skipToQueueItem('auto', 2))).toBe('d');
    expect(queue()).toMatchObject({ currentTrackId: 'd', userQueue: [], autoQueue: ['e'] });
    const rewound = [1, 2, 3, 4].map(() => run(() => queue().rewindQueue()));
    expect(rewound).toEqual(['c', 'b', 'u', 'a']);
  });

  test('skipping ahead in the user queue leaves the automatic queue alone', async () => {
    const { queue, run } = await startedQueue(['a', 'b']);
    for (const id of ['u1', 'u2', 'u3']) run(() => queue().addToQueue(id));

    expect(run(() => queue().skipToQueueItem('user', 1))).toBe('u2');
    expect(queue()).toMatchObject({ userQueue: ['u3'], autoQueue: ['b'], previousTrackId: 'u1' });
  });

  test('skipping to a position outside the queue does nothing', async () => {
    const { queue, run } = await startedQueue(['a', 'b']);
    expect(run(() => queue().skipToQueueItem('auto', 5))).toBeNull();
    expect(run(() => queue().skipToQueueItem('user', -1))).toBeNull();
    expect(queue()).toMatchObject({ currentTrackId: 'a', autoQueue: ['b'] });
  });

  test('history keeps only the last 50 tracks', async () => {
    const tracks = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const { queue, run } = await startedQueue(tracks);
    for (let i = 0; i < 55; i++) run(() => queue().advanceQueue());

    const rewound: Array<string | null> = [];
    for (let i = 0; i < 51; i++) rewound.push(run(() => queue().rewindQueue()));
    expect(rewound.at(0)).toBe('t54');
    expect(rewound.at(49)).toBe('t5');
    expect(rewound.at(50)).toBeNull();
  });

  test('queued tracks can be reordered and removed', async () => {
    const { queue, run } = await startedQueue(['a', 'b', 'c', 'd']);
    run(() => queue().reorderQueue('auto', 0, 2));
    expect(queue().autoQueue).toEqual(['c', 'd', 'b']);

    run(() => queue().addToQueue('x'));
    run(() => queue().addToQueue('y'));
    run(() => queue().removeFromQueue('user', 0));
    run(() => queue().removeFromQueue('auto', 1));
    expect(queue()).toMatchObject({ userQueue: ['y'], autoQueue: ['c', 'b'] });
    expect(lastSavedQueue()).toMatchObject({ userQueue: ['y'], autoQueue: ['c', 'b'] });
  });

  test('clearing empties the queue and saves the empty queue', async () => {
    const { queue, run } = await startedQueue(['a', 'b']);
    run(() => queue().clearQueue());
    expect(queue()).toMatchObject({ currentTrackId: null, hasNext: false, hasPrevious: false });
    expect(lastSavedQueue()).toMatchObject({ currentTrackId: null, autoQueue: [] });
  });

  test('a failed save does not interrupt playback', async () => {
    vi.mocked(saveAudioQueue).mockRejectedValue(new Error('offline'));
    const { queue, run } = await startedQueue(['a', 'b']);
    expect(run(() => queue().advanceQueue())).toBe('b');
    await act(async () => {});
    expect(queue().currentTrackId).toBe('b');
  });
});

describe('playback position', () => {
  test('is written on this device at most once per second of playback', async () => {
    const { queue } = await startedQueue(['a', 'b']);
    queue().persistTime(0.5);
    expect(localTime()).toBeNull();
    queue().persistTime(1.2);
    expect(localTime()).toEqual({ trackId: 'a', time: 1.2, updatedAt: NOW });
    queue().persistTime(1.9);
    expect(localTime().time).toBe(1.2);
    queue().persistTime(2.3);
    expect(localTime().time).toBe(2.3);
  });

  test('is sent to the server only once it has moved at least 2 seconds', async () => {
    const { queue } = await startedQueue(['a', 'b']);
    queue().persistTime(1.5);
    queue().flushTime();
    expect(updateQueueSavedTime).not.toHaveBeenCalled();

    queue().persistTime(2.5);
    queue().flushTime();
    queue().flushTime();
    expect(updateQueueSavedTime).toHaveBeenCalledExactlyOnceWith(2.5);
  });

  test('queue edits keep the position, while changing track resets it', async () => {
    const { queue, run } = await startedQueue(['a', 'b']);
    queue().persistTime(30);
    run(() => queue().addToQueue('x'));
    expect(lastSavedQueue()).toMatchObject({ currentTrackId: 'a', savedTime: 30 });
    expect(localTime().time).toBe(30);

    run(() => queue().advanceQueue());
    expect(lastSavedQueue()).toMatchObject({ currentTrackId: 'x', savedTime: 0 });
    expect(localTime()).toBeNull();
  });
});

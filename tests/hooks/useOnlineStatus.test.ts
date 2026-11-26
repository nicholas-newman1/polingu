import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from '../../src/hooks/useOnlineStatus';
import { saveUserData, syncAllPendingToFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import { syncContentFromFirestore } from '../../src/lib/offlineDb/contentSync';
import type { ContentData } from '../../src/lib/offlineDb/contentSync';
import { signInFakeUser } from '../fakes/firebase';
import { deferred } from './support/deferred';

// The two sync calls talk to Firestore; saving offline stays real (IndexedDB only).
vi.mock('../../src/lib/offlineDb/userDataWrapper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/offlineDb/userDataWrapper')>()),
  syncAllPendingToFirestore: vi.fn(),
}));
vi.mock('../../src/lib/offlineDb/contentSync', () => ({ syncContentFromFirestore: vi.fn() }));

let online = true;

beforeEach(() => {
  vi.resetAllMocks();
  online = true;
  vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(syncAllPendingToFirestore).mockResolvedValue(0);
  vi.mocked(syncContentFromFirestore).mockResolvedValue({} as ContentData);
});

const goOffline = () =>
  act(() => {
    online = false;
    window.dispatchEvent(new Event('offline'));
  });
const goOnline = () =>
  act(() => {
    online = true;
    window.dispatchEvent(new Event('online'));
  });

describe('useOnlineStatus', () => {
  test('follows the browser going offline and back online', () => {
    online = false;
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);
    goOnline();
    expect(result.current.isOnline).toBe(true);
    goOffline();
    expect(result.current.isOnline).toBe(false);
  });

  test('coming back online syncs pending changes and shared content once', async () => {
    const pending = deferred<number>();
    vi.mocked(syncAllPendingToFirestore).mockReturnValue(pending.promise);
    const { result } = renderHook(() => useOnlineStatus());
    goOffline();

    goOnline();
    expect(result.current.isSyncing).toBe(true);
    expect(syncAllPendingToFirestore).toHaveBeenCalledTimes(1);
    expect(syncContentFromFirestore).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(2));
    expect(result.current.isSyncing).toBe(false);
  });

  test('a sync requested while one is running is not started twice', async () => {
    const pending = deferred<number>();
    vi.mocked(syncAllPendingToFirestore).mockReturnValue(pending.promise);
    const { result } = renderHook(() => useOnlineStatus());

    await act(async () => {
      void result.current.triggerSync();
      void result.current.triggerSync();
    });
    goOnline();
    expect(syncAllPendingToFirestore).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(0));
    await act(() => result.current.triggerSync());
    expect(syncAllPendingToFirestore).toHaveBeenCalledTimes(2);
  });

  test('a manual sync does nothing while offline', async () => {
    online = false;
    const { result } = renderHook(() => useOnlineStatus());
    await act(() => result.current.triggerSync());
    expect(syncAllPendingToFirestore).not.toHaveBeenCalled();
  });

  test('a sync that never answers is given up after 10 seconds so a later one can run', async () => {
    // Only the sync timeout's timers: the in-memory IndexedDB behind the hook's
    // pending-change count schedules its work with setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(syncAllPendingToFirestore).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOnlineStatus());
    act(() => void result.current.triggerSync());
    expect(result.current.isSyncing).toBe(true);

    await act(async () => vi.advanceTimersByTime(9_999));
    expect(result.current.isSyncing).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(result.current.isSyncing).toBe(false);

    act(() => void result.current.triggerSync());
    expect(syncAllPendingToFirestore).toHaveBeenCalledTimes(2);
  });

  test('a failed sync ends the syncing state', async () => {
    vi.mocked(syncContentFromFirestore).mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() => useOnlineStatus());
    await act(() => result.current.triggerSync());
    expect(result.current.isSyncing).toBe(false);
  });

  test('counts changes saved while offline as pending', async () => {
    signInFakeUser('learner');
    const { result } = renderHook(() => useOnlineStatus());
    goOffline();

    await act(() => saveUserData('appSettings', { autoPlayAudio: true }));

    // A fix may count pending rows asynchronously (e.g. a live IndexedDB query).
    await vi.waitFor(() => expect(result.current.pendingSyncCount).toBeGreaterThan(0), {
      timeout: 300,
    });
  });
});

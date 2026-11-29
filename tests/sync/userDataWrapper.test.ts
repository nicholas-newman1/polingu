import { describe, expect, test, vi } from 'vitest';
import {
  cleanupLegacyReviewUserDataRows,
  deleteUserData,
  loadUserData,
  refreshAllUserDataFromFirestore,
  saveUserData,
  syncAllPendingToFirestore,
} from '../../src/lib/offlineDb/userDataWrapper';
import { userDb } from '../../src/lib/offlineDb/userDb';
import { loadSentenceTags } from '../../src/lib/storage/sentenceTags';
import { remote } from './support/fakeFirestore';
import { freezeTime, network, setTime, setupSyncTests, signIn, userPath } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

const UID = 'learner-a';
const settingsPath = userPath(UID, 'data', 'appSettings');
const sessionPath = userPath(UID, 'data', 'vocabularyReviewSession-pl-en');

describe('guest (signed out)', () => {
  test('saving does nothing locally or on the server', async () => {
    await saveUserData('appSettings', { autoPlayAudio: true });

    expect(await userDb.userData.count()).toBe(0);
    expect(remote.calls).toEqual([]);
  });

  test('loading returns the default without touching the network', async () => {
    remote.seed(settingsPath, { autoPlayAudio: true });

    expect(await loadUserData('appSettings', { autoPlayAudio: false })).toEqual({
      autoPlayAudio: false,
    });
    expect(remote.calls).toEqual([]);
  });

  test('sync and refresh are no-ops', async () => {
    expect(await syncAllPendingToFirestore()).toBe(0);
    await refreshAllUserDataFromFirestore();
    expect(remote.calls).toEqual([]);
  });
});

describe('saving while online', () => {
  test('writes the server copy and leaves nothing pending', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: true });

    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(await syncAllPendingToFirestore()).toBe(0);
  });

  test('a rejected server write surfaces the error and keeps the change for the next sync', async () => {
    signIn(UID);
    remote.fail({ op: 'setDoc', path: settingsPath }, { times: 1 });

    await expect(saveUserData('appSettings', { autoPlayAudio: true })).rejects.toThrow();
    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(remote.get(settingsPath)).toBeUndefined();

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });
});

describe('saving while offline', () => {
  test('keeps the change locally without calling the server', async () => {
    signIn(UID);
    network.goOffline();

    await saveUserData('appSettings', { autoPlayAudio: true });

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(remote.calls).toEqual([]);
  });

  test('pushes the change once back online, exactly once', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    network.goOnline();

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
    expect(await syncAllPendingToFirestore()).toBe(0);
  });

  test('only the latest of several offline edits to a doc is pushed', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    await saveUserData('appSettings', { autoPlayAudio: false, hidePolishText: true });
    network.goOnline();

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: false, hidePolishText: true });
  });

  test('pending changes survive the app being closed and reopened', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });

    userDb.close();
    await userDb.open();
    network.goOnline();

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });

  test('when navigator says online but the server is unreachable, the change waits for the next sync', async () => {
    signIn(UID);
    network.serverUnreachable();

    await expect(saveUserData('appSettings', { autoPlayAudio: true })).rejects.toThrow();
    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });

    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });
});

describe('draining pending changes', () => {
  test('one doc that keeps failing does not block the others, and is retried later', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    await saveUserData('userFilters', { declension: { cases: ['Genitive'] } });
    network.goOnline();
    remote.fail({ op: 'setDoc', path: settingsPath });

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath(UID, 'data', 'userFilters'))).toEqual({
      declension: { cases: ['Genitive'] },
    });
    expect(remote.get(settingsPath)).toBeUndefined();

    remote.clearFailures();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });

  test('a total outage pushes nothing and loses nothing', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    network.serverUnreachable();

    expect(await syncAllPendingToFirestore()).toBe(0);

    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });

  test('legacy single-document review rows are never pushed and are removed by cleanup', async () => {
    signIn(UID);
    await userDb.userData.bulkPut([
      { key: 'reviewData', data: { cards: {} }, lastModified: 1, pendingSync: 1 },
      { key: 'vocabularyReviewData-pl-en', data: { cards: {} }, lastModified: 1, pendingSync: 1 },
      { key: 'appSettings', data: { autoPlayAudio: true }, lastModified: 1, pendingSync: 0 },
    ]);

    expect(await syncAllPendingToFirestore()).toBe(0);
    await refreshAllUserDataFromFirestore();
    expect(remote.callsTo('setDoc', 'runTransaction', 'getDoc')).toEqual([
      `getDoc ${settingsPath}`,
    ]);

    await cleanupLegacyReviewUserDataRows();
    expect((await userDb.userData.toArray()).map((r) => r.key)).toEqual(['appSettings']);
  });
});

describe('deleting', () => {
  test('a doc deleted offline reads as the default and is deleted on the server once back online', async () => {
    signIn();
    await saveUserData('appSettings', { autoPlayAudio: true });
    network.goOffline();

    await deleteUserData('appSettings');
    expect(await loadUserData('appSettings', 'default')).toBe('default');

    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toBeUndefined();
    expect(await userDb.userData.get('appSettings')).toBeUndefined();
  });

  test('a delete the server rejects stays queued and is retried', async () => {
    signIn();
    await saveUserData('appSettings', { autoPlayAudio: true });
    remote.fail({ op: 'deleteDoc' }, { times: 1 });

    await expect(deleteUserData('appSettings')).rejects.toThrow();
    expect(await loadUserData('appSettings', 'default')).toBe('default');

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toBeUndefined();
  });
});

describe('undefined values', () => {
  test('a value saved with undefined fields reaches the server without them', async () => {
    signIn();
    await saveUserData('appSettings', { autoPlayAudio: true, dashboardOrder: undefined });

    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toEqual({
      autoPlayAudio: true,
    });
    expect((await userDb.userData.get('appSettings'))?.data).toEqual({ autoPlayAudio: true });
  });

  test('a pending row cached with an undefined field still syncs', async () => {
    signIn();
    // As left by older builds, which cached settings with undefined values.
    await userDb.userData.put({
      key: 'appSettings',
      data: { autoPlayAudio: false, dashboardOrder: undefined },
      lastModified: Date.now(),
      pendingSync: 1,
    });

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toEqual({
      autoPlayAudio: false,
    });
    expect((await userDb.userData.get('appSettings'))?.pendingSync).toBe(0);
  });
});

describe('loading', () => {
  test('on a cache miss, fetches from the server and serves later loads offline', async () => {
    signIn(UID);
    remote.seed(settingsPath, { autoPlayAudio: true });

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    network.goOffline();
    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
  });

  test('serves the cached copy without asking the server', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: true });
    remote.seed(settingsPath, { autoPlayAudio: false });
    remote.calls.length = 0;

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(remote.calls).toEqual([]);
  });

  test('a doc that does not exist yet loads as the default and is not created on the server', async () => {
    signIn(UID);

    expect(await loadUserData('appSettings', { autoPlayAudio: false })).toEqual({
      autoPlayAudio: false,
    });
    expect(remote.get(settingsPath)).toBeUndefined();
    expect(await syncAllPendingToFirestore()).toBe(0);
  });

  test('offline with nothing cached returns the default without calling the server', async () => {
    signIn(UID);
    network.goOffline();

    expect(await loadUserData('appSettings', { autoPlayAudio: false })).toEqual({
      autoPlayAudio: false,
    });
    expect(remote.calls).toEqual([]);
  });

  test('a server error returns the default and does not cache it, so the next load retries', async () => {
    signIn(UID);
    remote.seed(settingsPath, { autoPlayAudio: true });
    remote.fail({ op: 'getDoc' }, { times: 1 });

    expect(await loadUserData('appSettings', { autoPlayAudio: false })).toEqual({
      autoPlayAudio: false,
    });
    expect(await loadUserData('appSettings', { autoPlayAudio: false })).toEqual({
      autoPlayAudio: true,
    });
  });

  test('the deserializer is applied to cached and to fetched data alike', async () => {
    signIn(UID);
    remote.seed(settingsPath, { n: 1 });
    const parse = (raw: unknown) => ({ value: (raw as { n: number }).n * 10 });

    expect(await loadUserData('appSettings', { value: 0 }, parse)).toEqual({ value: 10 });
    expect(await loadUserData('appSettings', { value: 0 }, parse)).toEqual({ value: 10 });
  });
});

describe('background refresh', () => {
  test('pulls a change made on another device', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: true });
    remote.seed(settingsPath, { autoPlayAudio: false });

    await refreshAllUserDataFromFirestore();

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: false });
  });

  test('does not overwrite a local change that is still waiting to sync', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: false });
    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    network.goOnline();
    remote.seed(settingsPath, { autoPlayAudio: false, hidePolishText: true });

    await refreshAllUserDataFromFirestore();

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: true });
  });

  test('one failing doc does not stop the others from refreshing', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: true });
    await saveUserData('userFilters', { a: 1 });
    remote.seed(settingsPath, { autoPlayAudio: false });
    remote.seed(userPath(UID, 'data', 'userFilters'), { a: 2 });
    remote.fail({ op: 'getDoc', path: settingsPath });

    await refreshAllUserDataFromFirestore();

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    expect(await loadUserData('userFilters', null)).toEqual({ a: 2 });
  });

  test('skips internal cache rows such as the shared sentence tags', async () => {
    signIn(UID);
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: [], style: [] });
    await loadSentenceTags();
    remote.calls.length = 0;

    await refreshAllUserDataFromFirestore();

    expect(remote.calls).toEqual([]);
  });

  test('does nothing while offline', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: true });
    network.goOffline();
    remote.calls.length = 0;

    await refreshAllUserDataFromFirestore();

    expect(remote.calls).toEqual([]);
  });

  test('a change saved while a refresh is in flight is not overwritten by the older server copy', async () => {
    signIn(UID);
    await saveUserData('appSettings', { autoPlayAudio: false });

    const fetch = remote.hold('getDoc');
    const refreshing = refreshAllUserDataFromFirestore();
    await vi.waitFor(() => expect(remote.callsTo('getDoc')).toHaveLength(1));

    network.goOffline();
    await saveUserData('appSettings', { autoPlayAudio: true });
    fetch.release();
    await refreshing;

    expect(await loadUserData('appSettings', null)).toEqual({ autoPlayAudio: true });
    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
  });
});

describe('daily session counters across devices', () => {
  const session = (date: string, reviewed: number[], introduced: number[]) => ({
    reviewedToday: reviewed,
    newCardsToday: introduced,
    lastReviewDate: date,
  });

  test('on the same day, counters from two devices are combined rather than overwritten', async () => {
    signIn(UID);
    remote.seed(sessionPath, session('2026-11-26', [1, 2], [1]));

    await saveUserData('vocabularyReviewSession-pl-en', session('2026-11-26', [2, 3], [3]));

    expect(remote.get(sessionPath)).toEqual(session('2026-11-26', [1, 2, 3], [1, 3]));
    expect(await loadUserData('vocabularyReviewSession-pl-en', null)).toEqual(
      session('2026-11-26', [1, 2, 3], [1, 3])
    );
  });

  test("a new day's session replaces yesterday's counters on the server", async () => {
    signIn(UID);
    remote.seed(sessionPath, session('2026-11-25', [1, 2], [1]));

    await saveUserData('vocabularyReviewSession-pl-en', session('2026-11-26', [5], [5]));

    expect(remote.get(sessionPath)).toEqual(session('2026-11-26', [5], [5]));
  });

  test("a stale offline session from yesterday does not wipe today's counters from another device", async () => {
    freezeTime('2026-11-25T20:00:00-05:00');
    signIn(UID);
    network.goOffline();
    await saveUserData('vocabularyReviewSession-pl-en', session('2026-11-25', [9], [9]));

    setTime('2026-11-26T08:00:00-05:00');
    remote.seed(sessionPath, session('2026-11-26', [1], [1]));
    network.goOnline();

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(sessionPath)).toEqual(session('2026-11-26', [1], [1]));
    expect(await loadUserData('vocabularyReviewSession-pl-en', null)).toEqual(
      session('2026-11-26', [1], [1])
    );
  });

  test('a pending same-day session merges with the server copy when it finally syncs', async () => {
    signIn(UID);
    network.goOffline();
    await saveUserData('declensionReviewSession', session('2026-11-26', [3], [3]));
    network.goOnline();
    remote.seed(userPath(UID, 'data', 'declensionReviewSession'), session('2026-11-26', [1], []));

    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath(UID, 'data', 'declensionReviewSession'))).toEqual(
      session('2026-11-26', [1, 3], [3])
    );
  });

  test('a session doc that does not exist on the server yet is written as is', async () => {
    signIn(UID);

    await saveUserData('aspectPairsReviewSession', session('2026-11-26', [4], [4]));

    expect(remote.get(userPath(UID, 'data', 'aspectPairsReviewSession'))).toEqual(
      session('2026-11-26', [4], [4])
    );
  });

  test('a failed session merge keeps the local counters for the next sync', async () => {
    signIn(UID);
    remote.fail({ op: 'runTransaction' }, { times: 1 });

    await expect(
      saveUserData('vocabularyReviewSession-pl-en', session('2026-11-26', [1], [1]))
    ).rejects.toThrow();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(sessionPath)).toEqual(session('2026-11-26', [1], [1]));
  });

  test('settings are not merged: the latest write replaces the server copy', async () => {
    signIn(UID);
    remote.seed(settingsPath, { autoPlayAudio: true, dashboardOrder: ['a'] });

    await saveUserData('appSettings', { autoPlayAudio: false });

    expect(remote.get(settingsPath)).toEqual({ autoPlayAudio: false });
  });
});

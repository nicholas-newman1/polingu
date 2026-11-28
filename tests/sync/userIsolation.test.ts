import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { useAuthContext } from '../../src/hooks/useAuthContext';
import { clearUserData } from '../../src/lib/offlineDb/userSync';
import {
  loadUserData,
  saveUserData,
  syncAllPendingToFirestore,
} from '../../src/lib/offlineDb/userDataWrapper';
import { getCachedUser, setCachedUser } from '../../src/lib/cachedAuth';
import { loadCustomVocabulary, saveCustomVocabulary } from '../../src/lib/storage/customVocabulary';
import loadAppSettings from '../../src/lib/storage/loadAppSettings';
import { DEFAULT_APP_SETTINGS } from '../../src/types/appSettings';
import type { CustomVocabularyWord } from '../../src/types/vocabulary';
import { remote } from './support/fakeFirestore';
import { network, ratedCard, setupSyncTests, signIn, userPath } from './support/harness';
import { signOutFakeUser } from '../fakes/firebase';
import { stub } from '../helpers/stub';
import { declensionStorage } from '../../src/lib/storage/reviewDeckStorage';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

// AuthProvider reaches Firebase Auth through these three SDK calls. The fake keeps the
// listener AuthProvider registers, so a test can report sign-ins and session ends the
// way Firebase does, and runs the real AuthProvider code in response.
const authSdk = vi.hoisted(() => ({
  listener: null as ((user: unknown) => Promise<void> | void) | null,
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => Promise<void> | void) => {
    authSdk.listener = listener;
    return () => {
      if (authSdk.listener === listener) authSdk.listener = null;
    };
  },
  signInWithPopup: async () => {},
  // Firebase ends the session, then tells its listeners.
  signOut: async (auth: { currentUser: unknown }) => {
    auth.currentUser = null;
    await authSdk.listener?.(null);
  },
}));

setupSyncTests();

const word = (id: string, polish: string) =>
  stub<CustomVocabularyWord>({ id, isCustom: true, createdAt: 1, polish, english: 'x' });

const firebaseUser = (uid: string) =>
  stub<User>({
    uid,
    email: `${uid}@example.com`,
    getIdTokenResult: async () => stub<Awaited<ReturnType<User['getIdTokenResult']>>>({}),
  });

/** Renders the app's AuthProvider and returns its context. */
function renderAuth() {
  return renderHook(() => useAuthContext(), { wrapper: AuthProvider });
}
type Auth = ReturnType<typeof renderAuth>;

/** Firebase reports `uid` as signed in (a Google sign-in, or a session restored on start). */
async function firebaseSignsIn(uid: string) {
  signIn(uid);
  await act(async () => {
    await authSdk.listener!(firebaseUser(uid));
  });
}

/** Firebase ends the session by itself: token revoked or expired, account disabled. */
async function firebaseEndsSession() {
  signOutFakeUser();
  await act(async () => {
    await authSdk.listener!(null);
  });
}

/** The learner presses Sign out. */
async function signOutInApp(auth: Auth) {
  await act(() => auth.result.current.signOut());
}

/** Learner A with synced settings, a synced review, a custom word and one change still pending. */
async function learnerAWithData(): Promise<Auth> {
  const auth = renderAuth();
  await firebaseSignsIn('learner-a');
  await saveUserData('appSettings', { autoPlayAudio: true, hidePolishText: true });
  await declensionStorage.all.cards.saveCardsDiff(null, {
    1: { cardId: 1, fsrsCard: ratedCard('2026-11-20T10:00:00Z') },
  });
  await saveCustomVocabulary([word('custom_a', 'kot')]);
  network.goOffline();
  await saveUserData('userFilters', { declension: { cases: ['Genitive'] } });
  network.goOnline();
  return auth;
}

describe('signing out and in as someone else', () => {
  test('the next account sees only its own data, fetched from the server', async () => {
    const auth = await learnerAWithData();
    await signOutInApp(auth);
    expect(auth.result.current.user).toBeNull();

    await firebaseSignsIn('learner-b');
    remote.seed(userPath('learner-b', 'data', 'appSettings'), { autoPlayAudio: false });

    expect(auth.result.current.user?.uid).toBe('learner-b');
    expect(await loadAppSettings()).toEqual({ ...DEFAULT_APP_SETTINGS, autoPlayAudio: false });
    expect(await declensionStorage.all.cards.loadCards()).toEqual({});
    expect(await loadCustomVocabulary()).toEqual([]);
  });

  test("the previous account's pending change is never uploaded into the next account", async () => {
    const auth = await learnerAWithData();
    await signOutInApp(auth);

    await firebaseSignsIn('learner-b');
    expect(await syncAllPendingToFirestore()).toBe(0);
    await declensionStorage.all.cards.syncPendingCards();

    expect(remote.list(userPath('learner-b', 'data'))).toEqual({});
    expect(remote.list(userPath('learner-b', 'declensionReviewCards'))).toEqual({});
  });

  test('after signing out, an offline restart is a guest with nothing cached', async () => {
    const auth = await learnerAWithData();
    await signOutInApp(auth);

    expect(getCachedUser()).toBeNull();
    network.goOffline();
    expect(await loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(await declensionStorage.all.cards.loadCards()).toEqual({});
  });

  test("signing out never deletes the account's data on the server", async () => {
    const auth = await learnerAWithData();
    const before = remote.list(userPath('learner-a', 'declensionReviewCards'));

    await signOutInApp(auth);

    expect(remote.list(userPath('learner-a', 'declensionReviewCards'))).toEqual(before);
    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toEqual({
      autoPlayAudio: true,
      hidePolishText: true,
    });
  });

  test('signing back in restores the synced data from the server', async () => {
    const auth = await learnerAWithData();
    await signOutInApp(auth);

    await firebaseSignsIn('learner-a');

    expect(await loadAppSettings()).toEqual({ autoPlayAudio: true, hidePolishText: true });
    expect(Object.keys(await declensionStorage.all.cards.loadCards())).toEqual(['1']);
  });

  test('clearUserData empties every local table', async () => {
    await learnerAWithData();

    await clearUserData();

    network.goOffline();
    expect(await loadUserData('appSettings', 'nothing cached')).toBe('nothing cached');
    expect(await declensionStorage.all.cards.loadCards()).toEqual({});
    expect(await loadCustomVocabulary()).toEqual([]);
  });

  test("when Firebase ends the session by itself, the next account does not see the previous learner's data", async () => {
    await learnerAWithData();
    await firebaseEndsSession();
    await firebaseSignsIn('learner-b');

    expect(await loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    await syncAllPendingToFirestore();
    expect(remote.list(userPath('learner-b', 'data'))).toEqual({});
  });
  test('when Firebase ends the session and the same learner signs back in, their unsynced change still uploads', async () => {
    await learnerAWithData();
    await firebaseEndsSession();
    await firebaseSignsIn('learner-a');

    expect(await loadAppSettings()).toMatchObject({ autoPlayAudio: true, hidePolishText: true });
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath('learner-a', 'data', 'userFilters'))).toEqual({
      declension: { cases: ['Genitive'] },
    });
  });
});

describe('starting offline with a remembered account', () => {
  test('the cached account id is used while Firebase auth has not restored the session', async () => {
    signIn('learner-a');
    await saveUserData('appSettings', { autoPlayAudio: true, hidePolishText: false });
    signOutFakeUser();
    setCachedUser(stub<User>({ uid: 'learner-a', email: 'a@example.com' }));
    network.goOffline();

    expect(await loadAppSettings()).toEqual({ autoPlayAudio: true, hidePolishText: false });

    await saveUserData('appSettings', { autoPlayAudio: false, hidePolishText: false });
    network.goOnline();
    expect(await syncAllPendingToFirestore()).toBe(1);
    expect(remote.get(userPath('learner-a', 'data', 'appSettings'))).toEqual({
      autoPlayAudio: false,
      hidePolishText: false,
    });
  });

  test('with no remembered account the visitor is treated as a guest', async () => {
    setCachedUser(null);

    await saveUserData('appSettings', { autoPlayAudio: true });

    expect(await loadUserData('appSettings', 'default')).toBe('default');
    expect(remote.calls).toEqual([]);
  });
});

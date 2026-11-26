/**
 * Shared setup for the sync tests. Each test file must also install the fake SDK:
 *
 *   vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
 *
 * then call `setupSyncTests()` once at the top level.
 */
import { beforeEach, vi } from 'vitest';
import { createEmptyCard, type Card } from 'ts-fsrs';
import { userDb } from '../../../src/lib/offlineDb/userDb';
import { contentDb } from '../../../src/lib/offlineDb/contentDb';
import rateCard from '../../../src/lib/fsrsUtils/rateCard';
import { remote } from './fakeFirestore';
import { signInFakeUser } from '../../fakes/firebase';

let online = true;
Object.defineProperty(window.navigator, 'onLine', {
  configurable: true,
  get: () => online,
});

/** The browser's connectivity and the server's reachability, switched together. */
export const network = {
  goOffline() {
    online = false;
    remote.offline = true;
  },
  goOnline() {
    online = true;
    remote.reconnect();
  },
  /** navigator.onLine stays true, but nothing reaches the server (captive portal, flaky link). */
  serverUnreachable() {
    online = true;
    remote.offline = true;
  },
};

export function setupSyncTests() {
  beforeEach(async () => {
    online = true;
    remote.reset();
    await Promise.all([
      userDb.userData.clear(),
      userDb.customCards.clear(),
      userDb.reviewCards.clear(),
      contentDb.sentences.clear(),
      contentDb.verbs.clear(),
      contentDb.vocabulary.clear(),
      contentDb.declensionCards.clear(),
      contentDb.meta.clear(),
    ]);
    // The code under test logs every failed sync; keep the output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
}

/**
 * Freeze `Date` only. fake-indexeddb schedules its work with timers, so faking
 * those would stall every IndexedDB call.
 */
export function freezeTime(iso: string | Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

export function setTime(iso: string | Date) {
  vi.setSystemTime(new Date(iso));
}

export function signIn(uid = 'learner-a') {
  return signInFakeUser(uid, `${uid}@example.com`);
}

/** A card the learner rated `Good` at `at`. */
export function ratedCard(at: string | Date): Card {
  const when = new Date(at);
  return rateCard({ fsrsCard: createEmptyCard(when) }, 3, when).fsrsCard;
}

export const userPath = (uid: string, ...rest: string[]) => ['users', uid, ...rest].join('/');

/** Wait for queued microtasks and IndexedDB work to settle. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

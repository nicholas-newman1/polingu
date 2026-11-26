/**
 * Renders review pages the way src/main.tsx does: the app's real providers and
 * routes, with Firebase faked at the SDK boundary. Each test file must install
 * the fakes itself (vi.mock is hoisted per file):
 *
 *   vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
 *   vi.mock('firebase/auth', () => import('./support/fakeAuth'));
 *   vi.mock('firebase/functions', () => import('./support/fakeCloud'));
 *   vi.mock('firebase/storage', () => import('./support/fakeCloud'));
 *   vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));
 *
 * then call `setupReviewUi()` once at the top level.
 *
 * Time stands still unless a test moves it with `elapse()`, so timer-driven
 * behaviour (buffered saves, exit animations, auto-play delays) happens at the
 * same point in every run. Asynchronous work that does not wait on the clock
 * (IndexedDB, promises, zero-delay timers) runs whenever a test waits with
 * `until()` or `settle()`. RTL's findBy* and waitFor poll on timers, so they
 * would hang here: use `until()` instead.
 */
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { userDb } from '../../../../src/lib/offlineDb/userDb';
import { contentDb } from '../../../../src/lib/offlineDb/contentDb';
import { remote } from '../../../sync/support/fakeFirestore';
import { network } from '../../../sync/support/harness';
import { signInFakeUser } from '../../../fakes/firebase';
import { playCardChime } from '../../../../src/lib/cardFeedback';
import { AppTree } from './AppTree';
import { browser, installBrowser } from './browser';
import { NOW, UID } from './content';

/** How long a rating waits before it is saved, and how long an exiting card lingers. */
const SAVE_AND_EXIT_MS = 500;

/** Turns of the event loop `until()` allows before giving up (opening a page takes about 30). */
const MAX_TICKS = 500;

/** Turns of the event loop without any IndexedDB or Firestore activity that count as settled. */
const QUIET_TICKS = 20;

/** IndexedDB transactions started since the test began, and those still running. */
const indexedDb = { started: 0, running: new Set<IDBTransaction>() };

// Dexie binds `transaction` when it opens a database (on first use, in the first
// beforeEach), so a spy set up per test would never see a call: wrap it once, as this
// module loads, before any database is opened. The wrapper only counts.
const openTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (
  this: IDBDatabase,
  ...args: Parameters<IDBDatabase['transaction']>
) {
  const tx = openTransaction.apply(this, args);
  indexedDb.started++;
  indexedDb.running.add(tx);
  const finished = () => indexedDb.running.delete(tx);
  tx.addEventListener('complete', finished);
  tx.addEventListener('abort', finished);
  return tx;
};

export function setupReviewUi() {
  beforeEach(async () => {
    remote.reset();
    network.goOnline();
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
    installBrowser();
    indexedDb.started = 0;
    indexedDb.running.clear();
    // The app logs failed background work (and Cloud Functions are unavailable here).
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // setImmediate stays real: fake-indexeddb runs on it.
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    // A chime holds back auto-play for a moment. The clock goes back to NOW for
    // every test, so a chime from an earlier test would seem to be still playing.
    vi.setSystemTime(0);
    playCardChime('next');
    browser.chimeNotes = 0;
    vi.setSystemTime(NOW);
    signInFakeUser(UID, `${UID}@example.com`);
  });

  // Unmounting saves buffered ratings, and background syncs may still be running:
  // let them finish so they cannot write into the next test's fresh database.
  afterEach(async () => {
    cleanup();
    await settle();
  });
}

/**
 * One turn of the event loop: IndexedDB callbacks, settled promises and timers
 * already due run, and React renders what they changed. The clock stays put.
 */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    vi.advanceTimersByTime(0);
  });
}

/**
 * Lets the app's asynchronous work run until `check` stops throwing, and returns
 * its result: the deterministic stand-in for RTL's findBy* and waitFor.
 */
export async function until<T>(check: () => T): Promise<T> {
  let failure: unknown;
  for (let i = 0; i < MAX_TICKS; i++) {
    try {
      return check();
    } catch (error) {
      failure = error;
    }
    await tick();
  }
  throw failure;
}

/**
 * Waits until the app has stopped working in the background: no IndexedDB
 * transaction running, and none started and no Firestore call made for a while.
 * Covers the initial load, the background sync that follows it, and saves.
 */
export async function settle() {
  const activity = () => `${remote.calls.length}:${indexedDb.started}`;
  let seen = activity();
  let quiet = 0;
  for (let i = 0; quiet < QUIET_TICKS; i++) {
    if (i === MAX_TICKS) throw new Error('The app never stopped working in the background');
    await tick();
    const now = activity();
    if (now === seen && indexedDb.running.size === 0) quiet++;
    else {
      seen = now;
      quiet = 0;
    }
  }
}

/** Renders the app at `path` (see AppTree). */
export function renderApp(path: string, extra?: ReactNode) {
  const result = render(<AppTree path={path} extra={extra} />);

  /** Queries limited to the page itself, leaving out exiting-card clones and dialogs. */
  const page = within(result.container);
  return { ...result, page };
}

/** The current route, as the router sees it. */
export const currentPath = () => screen.getByRole('status', { name: 'Current page' }).textContent;

/** Moves the clock: a rating's buffered save, an exiting card's animation. */
export const elapse = (ms = SAVE_AND_EXIT_MS) => act(() => vi.advanceTimersByTime(ms));

export const click = (element: HTMLElement) => fireEvent.click(element);

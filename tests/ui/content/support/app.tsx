/**
 * Renders the whole app (see ./AppTree.tsx) with Firebase faked at the SDK boundary. Each test
 * file needs:
 *
 *   vi.mock('firebase/firestore', () => import('./support/firestore'));
 *   vi.mock('firebase/functions', () => import('./support/functions'));
 *   vi.mock('firebase/storage', () => import('./support/storage'));
 *   vi.mock('firebase/auth', () => import('./support/auth'));
 *
 * and `setupUiTests()` once at the top level.
 */
import type { ReactElement } from 'react';
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, onTestFinished, vi } from 'vitest';
import { setupSyncTests } from '../../../sync/support/harness';
import { remote } from './firestore';
import { accounts, type Account } from './auth';
import { callables } from './functions';
import { uploads } from './storage';
import { installBrowserStubs } from './browser';
import { App, Shell } from './AppTree';

// Whole-app renders on a busy machine can take more than the default second to settle,
// and a test that opens several dialogs more than the default five seconds to finish.
configure({ asyncUtilTimeout: 5000 });

/** Resets every fake before each test. Call once at the top level of a test file. */
export function setupUiTests() {
  vi.setConfig({ testTimeout: 20_000 });
  setupSyncTests();
  beforeEach(() => {
    installBrowserStubs();
    callables.reset();
    uploads.reset();
    accounts.reset();
  });
  afterEach(async () => {
    // The app keeps syncing in the background after it unmounts. Cut it off from the
    // server and let it wind down, so it cannot write into the next test's IndexedDB.
    cleanup();
    remote.offline = true;
    await quiesce();
  });
}

/**
 * IndexedDB transactions started so far and those still running. The background sync
 * ends with IndexedDB work only (re-reading everything it fetched), so watching Firestore
 * calls alone can declare the app idle while that last step is still under way.
 */
const idbActivity = { started: 0, running: 0 };
const TRACKED = Symbol.for('polingu.tests.trackedIdbTransactions');
const idbPrototype = IDBDatabase.prototype as IDBDatabase & { [TRACKED]?: true };
if (!idbPrototype[TRACKED]) {
  const originalTransaction = idbPrototype.transaction;
  idbPrototype.transaction = function (
    this: IDBDatabase,
    ...args: Parameters<IDBDatabase['transaction']>
  ) {
    const transaction = originalTransaction.apply(this, args);
    idbActivity.started++;
    idbActivity.running++;
    const finish = () => idbActivity.running--;
    transaction.addEventListener('complete', finish, { once: true });
    transaction.addEventListener('abort', finish, { once: true });
    return transaction;
  };
  idbPrototype[TRACKED] = true;
}

/**
 * Resolves once neither Firestore nor IndexedDB has been touched for a few consecutive
 * ticks: the app has finished the background sync it starts after loading.
 */
export async function quiesce() {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
  let quietTicks = 0;
  for (let i = 0; i < 200 && quietTicks < 3; i++) {
    const calls = remote.calls.length;
    const transactions = idbActivity.started;
    await tick();
    const quiet =
      remote.calls.length === calls &&
      idbActivity.started === transactions &&
      idbActivity.running === 0;
    quietTicks = quiet ? quietTicks + 1 : 0;
  }
}

/**
 * Collects the promise rejections nothing handles during the current test, instead of
 * letting them fail the whole run, so the test can check for them. The test runner's own
 * handlers are put back when the test finishes.
 */
export function captureUnhandledRejections() {
  const rejections: unknown[] = [];
  const runnerListeners = process.listeners('unhandledRejection');
  const collect = (reason: unknown) => rejections.push(reason);
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', collect);
  onTestFinished(() => {
    process.off('unhandledRejection', collect);
    for (const listener of runnerListeners) process.on('unhandledRejection', listener);
  });
  return rejections;
}

export const LEARNER: Account = { uid: 'learner-a', displayName: 'Ada Lovelace' };
export const ADMIN: Account = { uid: 'admin-a', displayName: 'Admin Person', admin: true };

interface RenderAppOptions {
  /** Signed in when the app starts; omit (or null) for a guest. */
  account?: Account | null;
}

/** Renders the whole app at `route`. */
export function renderApp(route: string, { account = LEARNER }: RenderAppOptions = {}) {
  if (account) accounts.signIn(account);
  const result = render(<App route={route} />);
  return {
    ...result,
    /** The path the router is showing. */
    location: () => screen.getByTestId('location').textContent,
  };
}

/**
 * Renders `ui` inside the app's outer shell only (theme, snackbar, sign-in), for
 * dialogs that do not depend on the review data.
 */
export function renderInShell(ui: ReactElement, { account = LEARNER }: RenderAppOptions = {}) {
  if (account) accounts.signIn(account);
  return render(<Shell>{ui}</Shell>);
}

/** Waits until the review data has loaded. */
export async function waitForReviewData() {
  await waitFor(() =>
    expect(screen.getByTestId('review-data')).toHaveAttribute('data-loading', 'false')
  );
}

export { accounts, callables, uploads };

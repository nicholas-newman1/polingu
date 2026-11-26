/**
 * Shared setup for media tests that touch Firestore, Storage, callables or the
 * IndexedDB caches. Each test file must also install the fakes it needs:
 *
 *   vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
 *   vi.mock('firebase/storage', () => import('./support/fakeStorage'));
 *   vi.mock('firebase/functions', () => import('./support/fakeFunctions'));
 *
 * then call `setupMediaTests()` once at the top level. Before each test it resets the
 * fakes, the Dexie tables and the IndexedDB audio blob cache.
 */
import { beforeEach } from 'vitest';
import { setupSyncTests } from '../../sync/support/harness';
import { bucket } from './fakeStorage';
import { server } from './fakeFunctions';
import { clearAudioBlobStore } from './audioBlobStore';

export { network, settle, signIn, userPath } from '../../sync/support/harness';
export { flushMicrotasks } from './async';

export function setupMediaTests() {
  setupSyncTests();
  beforeEach(async () => {
    bucket.reset();
    server.reset();
    await clearAudioBlobStore();
  });
}

/** A File whose reported size is `size` bytes, without allocating that much memory. */
export function fileOfSize(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

export const MB = 1024 * 1024;

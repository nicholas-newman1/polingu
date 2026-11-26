import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { signOutFakeUser } from '../fakes/firebase';

// Never let a unit test reach the production Firebase project.
vi.mock('../../src/lib/firebase', () => import('../fakes/firebase'));

beforeEach(() => {
  // Fail loudly on any network call a test did not stub itself
  // (vi.stubGlobal('fetch', ...) in the test overrides this).
  vi.stubGlobal('fetch', (input: unknown) => {
    throw new Error(`Unmocked fetch in a unit test: ${String(input)}`);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  signOutFakeUser();
  localStorage.clear();
});

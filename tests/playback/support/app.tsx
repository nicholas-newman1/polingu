/**
 * Renders the playback part of the app the way main.tsx and Layout.tsx wire it:
 * AudioPlayerProvider and ListeningProvider above the router, the real audio and
 * listening pages as routes, and ListeningMiniBar outside the routes so it shows
 * on every page.
 *
 * Auth, snackbars and the review data are stand-ins with fixed values; the audio
 * library, queue and listening settings go through the real storage code to the
 * fake Firestore. A test file using this must install the SDK fakes:
 *
 *   vi.mock('firebase/firestore', () => import('./support/firestore'));
 *   vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
 *   vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));
 */
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../src/lib/theme';
import { AuthContext } from '../../../src/contexts/AuthContext';
import { SnackbarContext, type SnackbarContextType } from '../../../src/contexts/SnackbarContext';
import { TranslationProvider } from '../../../src/contexts/TranslationContext';
import { AudioPlayerProvider } from '../../../src/contexts/AudioPlayerContext';
import { ListeningProvider } from '../../../src/contexts/ListeningContext';
import { AudioLibraryPage } from '../../../src/pages/AudioLibraryPage';
import { AudioPlayerPage } from '../../../src/pages/AudioPlayerPage';
import { ListeningHubPage } from '../../../src/pages/ListeningHubPage';
import { ListeningPlayerPage } from '../../../src/pages/ListeningPlayerPage';
import { ListeningMiniBar } from '../../../src/components/ListeningMiniBar';
import { userDb } from '../../../src/lib/offlineDb/userDb';
import type { AudioItem, AudioQueue, SystemAudioItem } from '../../../src/types/audio';
import { signInFakeUser } from '../../fakes/firebase';
import { remote } from '../../sync/support/fakeFirestore';
import { STORAGE_ORIGIN, storageServer } from './firebaseStorage';
import { callables } from './firebaseFunctions';
import { Probes, ReviewDataStub } from './AppParts';
import { probe, srsWrites, type ReviewFixture } from './probes';

export const UID = 'listener-1';

// ---------------------------------------------------------------------------
// Audio library fixtures

export const trackPath = (id: string) => `audio/${UID}/${id}.mp3`;
export const trackUrl = (id: string) => STORAGE_ORIGIN + trackPath(id);
export const systemTrackPath = (id: string) => `systemAudio/${id}.mp3`;
export const systemTrackUrl = (id: string) => STORAGE_ORIGIN + systemTrackPath(id);

export function track(id: string, overrides: Partial<AudioItem> = {}): AudioItem {
  return {
    id,
    userId: UID,
    title: `Track ${id}`,
    fileName: `${id}.mp3`,
    duration: 100,
    fileSize: 1000,
    storagePath: trackPath(id),
    status: 'ready',
    transcript: [],
    createdAt: 1000,
    ...overrides,
  };
}

export function systemTrack(id: string, overrides: Partial<SystemAudioItem> = {}): SystemAudioItem {
  return {
    id,
    title: `System ${id}`,
    text: 'Tekst',
    storagePath: systemTrackPath(id),
    duration: 100,
    status: 'ready',
    transcript: [],
    createdAt: 1000,
    ...overrides,
  };
}

/** Puts tracks on the server, as uploads or the admin would. */
export function seedTracks(...items: AudioItem[]) {
  for (const item of items) remote.seed(`users/${UID}/audioItems/${item.id}`, item);
}

export function seedSystemTracks(...items: SystemAudioItem[]) {
  for (const item of items) remote.seed(`systemAudioItems/${item.id}`, item);
}

const byNewest = <T extends { createdAt: number }>(items: T[]) =>
  [...items].sort((a, b) => b.createdAt - a.createdAt);

/**
 * A returning listener's library: the tracks are on the server and in the app's
 * offline copy of the library list, as they are after any earlier visit.
 */
export async function seedLibrary({
  tracks = [],
  systemTracks = [],
}: {
  tracks?: AudioItem[];
  systemTracks?: SystemAudioItem[];
}) {
  seedTracks(...tracks);
  seedSystemTracks(...systemTracks);
  const lastModified = Date.now();
  await userDb.userData.bulkPut([
    { key: '__audio-items-list', data: byNewest(tracks), lastModified, pendingSync: 0 },
    {
      key: '__system-audio-items-list',
      data: byNewest(systemTracks),
      lastModified,
      pendingSync: 0,
    },
  ]);
}

export const queuePath = `users/${UID}/audioQueue/current`;

export function seedQueue(queue: Partial<AudioQueue>) {
  remote.seed(queuePath, {
    currentTrackId: null,
    userQueue: [],
    autoQueue: [],
    history: [],
    savedTime: 0,
    updatedAt: 0,
    ...queue,
  });
}

// ---------------------------------------------------------------------------
// What the rendered app exposes to tests

/** The audio player context as the pages last saw it. */
export function player() {
  if (!probe.player) throw new Error('The app is not rendered');
  return probe.player;
}

/** The listening context as the pages last saw it. */
export function listening() {
  if (!probe.listening) throw new Error('The app is not rendered');
  return probe.listening;
}

/** Client-side navigation, as tapping a link in the app does. */
export function goTo(path: string) {
  act(() => probe.navigate!(path));
}

const appTheme = createAppTheme('light');

export const snackbar = vi.fn<SnackbarContextType['showSnackbar']>();

interface RenderOptions {
  route?: string;
  isAdmin?: boolean;
  strict?: boolean;
  review?: ReviewFixture;
}

export function renderApp({
  route = '/audio',
  isAdmin = false,
  strict = false,
  review = {},
}: RenderOptions = {}) {
  signInFakeUser(UID, `${UID}@example.com`);
  const user = { uid: UID, email: `${UID}@example.com` } as User;
  const auth = {
    user,
    loading: false,
    isAdmin,
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
  const snackbarValue: SnackbarContextType = {
    snackbar: null,
    showSnackbar: snackbar,
    hideSnackbar: () => {},
  };

  const tree = (
    <ThemeProvider theme={appTheme}>
      <AuthContext.Provider value={auth}>
        <SnackbarContext.Provider value={snackbarValue}>
          <ReviewDataStub fixture={review}>
            <TranslationProvider>
              <AudioPlayerProvider>
                <ListeningProvider>
                  <MemoryRouter initialEntries={[route]}>
                    <Routes>
                      <Route path="/audio" element={<AudioLibraryPage />} />
                      <Route path="/audio/player" element={<AudioPlayerPage />} />
                      <Route path="/listen" element={<ListeningHubPage />} />
                      <Route path="/listen/play" element={<ListeningPlayerPage />} />
                      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
                    </Routes>
                    <ListeningMiniBar />
                    <Probes />
                  </MemoryRouter>
                </ListeningProvider>
              </AudioPlayerProvider>
            </TranslationProvider>
          </ReviewDataStub>
        </SnackbarContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  );

  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

// ---------------------------------------------------------------------------
// Settling async work

const nextMacrotask = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Lets pending promises, IndexedDB work and snapshot deliveries run. */
export async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await nextMacrotask();
    });
  }
}

/**
 * Settles until `check` passes (returns anything but `false` without throwing).
 * Works with fake timers, because IndexedDB and these waits use setImmediate.
 */
export async function waitUntil(check: () => unknown, max = 100) {
  for (let i = 0; i < max; i++) {
    try {
      if (check() !== false) return;
    } catch {
      // not yet
    }
    await act(async () => {
      await nextMacrotask();
    });
  }
  if (check() === false) throw new Error('waitUntil: condition never became true');
}

/**
 * Fake clock for timers, animation frames and performance.now. setImmediate stays
 * real so IndexedDB keeps working.
 */
export function freezeClock(start = '2026-03-10T20:00:00') {
  vi.useFakeTimers({
    toFake: [
      'Date',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  vi.setSystemTime(new Date(start));
}

/** Resets the fakes and local databases before each test of the calling file. */
export function setupApp() {
  beforeEach(async () => {
    remote.reset();
    storageServer.reset();
    callables.reset();
    snackbar.mockReset();
    srsWrites.mockReset();
    await userDb.userData.clear();
    await clearAudioBlobCache();
    // Downloads of track blobs for the offline cache fail unless a test says otherwise.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline')))
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(async () => {
    // Unmount, then let saves still in flight land before the next test clears the
    // databases; otherwise a late write leaks into the next test.
    cleanup();
    await settle();
    probe.player = null;
    probe.listening = null;
    probe.navigate = null;
  });
}

// ---------------------------------------------------------------------------
// The IndexedDB cache of downloaded track blobs (src/lib/audio/audioCache.ts)

function openBlobCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('polingu-audio-cache', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('audio-blobs')) {
        request.result.createObjectStore('audio-blobs');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withBlobStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openBlobCache();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction('audio-blobs', mode).objectStore('audio-blobs'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const clearAudioBlobCache = () => withBlobStore('readwrite', (store) => store.clear());

export const cacheAudioBlobFor = (audioId: string, content = 'audio-bytes') =>
  withBlobStore('readwrite', (store) => store.put(content, audioId));

export const cachedAudioBlobKeys = () =>
  withBlobStore('readonly', (store) => store.getAllKeys()) as Promise<string[]>;

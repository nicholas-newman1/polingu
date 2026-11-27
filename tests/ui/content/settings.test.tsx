import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  captureUnhandledRejections,
  quiesce,
  renderApp,
  setupUiTests,
  waitForReviewData,
  LEARNER,
} from './support/app';
import { userPath } from './support/data';
import { remote } from './support/firestore';
import { audioCaches } from './support/browser';
import { network } from '../../sync/support/harness';
import { findDialog, waitForDialogsToClose } from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const UID = LEARNER.uid;
const AUDIO_CACHE = 'polingu-audio';

async function openSettings() {
  const app = renderApp('/settings');
  await screen.findByRole('heading', { name: 'Settings', level: 5 });
  return app;
}

/** The on/off switch in the settings row titled `title`. */
function settingSwitch(title: string) {
  const row = screen.getByText(title).closest('.MuiCardContent-root > div') as HTMLElement;
  return within(row).getByRole('switch');
}

/** Built-in content with recorded audio: one sentence, word and card, and a verb with two clips. */
function seedContentWithAudio() {
  remote.seed('sentences/s1', {
    id: 's1',
    polish: 'Mam kota.',
    english: 'I have a cat.',
    level: 'A1',
    tags: [],
    audioUrl: 'https://audio.test/s1.mp3',
  });
  remote.seed('vocabulary/1', {
    id: 1,
    polish: 'kot',
    english: 'cat',
    audioUrl: 'https://audio.test/v1.mp3',
  });
  remote.seed('vocabulary/2', { id: 2, polish: 'pies', english: 'dog' });
  remote.seed('declensionCards/1', {
    id: 1,
    front: 'Nie mam ___.',
    back: 'Nie mam kota.',
    declined: 'kota',
    case: 'Genitive',
    gender: 'Masculine',
    number: 'Singular',
    audioUrl: 'https://audio.test/d1.mp3',
  });
  remote.seed('verbs/robic', {
    id: 'robic',
    infinitive: 'robić',
    infinitiveEn: 'to do',
    aspect: 'Imperfective',
    verbClass: '-ić',
    infinitiveAudioUrl: 'https://audio.test/robic.mp3',
    conjugations: {
      present: { '1sg': { pl: 'robię', en: ['I do'], audioUrl: 'https://audio.test/robie.mp3' } },
    },
  });
}

describe('Settings', () => {
  test('audio and display preferences are saved and kept for the next visit', async () => {
    const app = await openSettings();
    await waitFor(() => expect(settingSwitch('Auto-play audio & chimes')).not.toBeChecked());
    fireEvent.click(settingSwitch('Auto-play audio & chimes'));
    fireEvent.click(settingSwitch('Hide Polish text'));
    expect(settingSwitch('Auto-play audio & chimes')).toBeChecked();
    expect(settingSwitch('Hide Polish text')).toBeChecked();

    await waitFor(() =>
      expect(remote.get(userPath(UID, 'data', 'appSettings'))).toMatchObject({
        autoPlayAudio: true,
        hidePolishText: true,
      })
    );
    app.unmount();

    await openSettings();
    await waitFor(() => expect(settingSwitch('Auto-play audio & chimes')).toBeChecked());
    expect(settingSwitch('Hide Polish text')).toBeChecked();
  });

  test('settings saved on another device are shown', async () => {
    remote.seed(userPath(UID, 'data', 'appSettings'), {
      autoPlayAudio: true,
      hidePolishText: false,
    });
    await openSettings();
    await waitFor(() => expect(settingSwitch('Auto-play audio & chimes')).toBeChecked());
    expect(settingSwitch('Hide Polish text')).not.toBeChecked();
  });

  test('a guest’s choices apply for the visit but are not saved anywhere', async () => {
    const app = renderApp('/settings', { account: null });
    await screen.findByRole('heading', { name: 'Settings', level: 5 });
    fireEvent.click(settingSwitch('Hide Polish text'));
    expect(settingSwitch('Hide Polish text')).toBeChecked();
    await act(quiesce);
    expect(remote.callsTo('setDoc', 'updateDoc', 'batch.commit')).toEqual([]);
    app.unmount();

    renderApp('/settings', { account: null });
    await screen.findByRole('heading', { name: 'Settings', level: 5 });
    await act(quiesce);
    expect(settingSwitch('Hide Polish text')).not.toBeChecked();
  });

  const APP_SETTINGS = userPath(UID, 'data', 'appSettings');

  /** Turns on "Hide Polish text" while the server refuses the write once. */
  async function changeSettingTheServerRefuses() {
    await openSettings();
    await waitForReviewData();
    await act(quiesce);
    remote.fail({ op: 'setDoc', path: APP_SETTINGS }, { times: 1 });
    fireEvent.click(settingSwitch('Hide Polish text'));
    await waitFor(() => expect(remote.callsTo('setDoc')).toContain(`setDoc ${APP_SETTINGS}`));
    await act(quiesce);
  }

  test('a setting the server refuses is kept and saved at the next sync', async () => {
    captureUnhandledRejections();
    await changeSettingTheServerRefuses();
    expect(settingSwitch('Hide Polish text')).toBeChecked();
    expect(remote.get(APP_SETTINGS)).toBeUndefined();

    // Coming back to the app syncs whatever is still waiting.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(remote.get(APP_SETTINGS)).toMatchObject({ hidePolishText: true }));
  });

  test('a setting the server refuses raises no unhandled error', async () => {
    const rejections = captureUnhandledRejections();
    await changeSettingTheServerRefuses();
    expect(rejections).toEqual([]);
  });

  test('"Customize" opens the dashboard order dialog', async () => {
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const dialog = await findDialog('Customize Dashboard');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitForDialogsToClose();
  });
});

describe('Offline audio', () => {
  test('counts the built-in audio clips and downloads them all for offline use', async () => {
    seedContentWithAudio();
    await openSettings();
    await waitForReviewData();
    expect(await screen.findByText('5 total audio files')).toBeInTheDocument();
    expect(screen.getByText('0 files cached')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Cache' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Download All Audio' }));
    expect(await screen.findByText('5 files cached')).toBeInTheDocument();
    expect([...(audioCaches.stores.get(AUDIO_CACHE) ?? [])].sort()).toEqual([
      'https://audio.test/d1.mp3',
      'https://audio.test/robic.mp3',
      'https://audio.test/robie.mp3',
      'https://audio.test/s1.mp3',
      'https://audio.test/v1.mp3',
    ]);
    expect(screen.getByRole('button', { name: 'Download All Audio' })).toBeEnabled();
  });

  test('files that fail to download are counted while the download runs and left out', async () => {
    seedContentWithAudio();
    audioCaches.failing.add('https://audio.test/v1.mp3');
    // Hold the last file so the progress can be read mid-download.
    let releaseLast!: () => void;
    const realOpen = (
      caches as unknown as { open: (n: string) => Promise<{ add: (u: string) => Promise<void> }> }
    ).open;
    vi.stubGlobal('caches', {
      ...caches,
      open: async (name: string) => {
        const cache = await realOpen(name);
        return {
          ...cache,
          add: async (url: string) => {
            if (url === 'https://audio.test/robie.mp3') {
              await new Promise<void>((resolve) => (releaseLast = resolve));
            }
            return cache.add(url);
          },
        };
      },
    });
    await openSettings();
    await waitForReviewData();
    await screen.findByText('5 total audio files');

    fireEvent.click(screen.getByRole('button', { name: 'Download All Audio' }));
    expect(await screen.findByText('1 files failed to download')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downloading...' })).toBeDisabled();
    expect(screen.getByText(/Downloading: \d \/ 5/)).toBeInTheDocument();

    await waitFor(() => expect(releaseLast).toBeTypeOf('function'));
    act(() => releaseLast());
    expect(await screen.findByText('4 files cached')).toBeInTheDocument();
    expect(screen.queryByText(/failed to download/)).toBeNull();
  });

  test('clearing the cache removes the downloaded audio', async () => {
    audioCaches.stores.set(
      AUDIO_CACHE,
      new Set(['https://audio.test/a.mp3', 'https://audio.test/b.mp3'])
    );
    audioCaches.fileBytes.set('https://audio.test/a.mp3', 1.5 * 1024 * 1024);
    audioCaches.fileBytes.set('https://audio.test/b.mp3', 1.5 * 1024 * 1024);
    // Other site data must not count towards the audio cache's size.
    audioCaches.usageBytes = 50 * 1024 * 1024;
    await openSettings();
    expect(await screen.findByText('2 files cached')).toBeInTheDocument();
    expect(screen.getByText('3 MB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }));
    expect(await screen.findByText('0 files cached')).toBeInTheDocument();
    expect(audioCaches.stores.get(AUDIO_CACHE)?.size ?? 0).toBe(0);
    expect(screen.queryByText('3 MB')).toBeNull();
  });

  test('downloading is not offered offline', async () => {
    network.goOffline();
    await openSettings();
    expect(screen.getByText("You're offline. Connect to download audio.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download All Audio' })).toBeDisabled();
  });
});

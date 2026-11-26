/**
 * Card audio in the review pages: useAudioPlayer (play / stop / auto-play) and
 * usePrefetchAudio (download ahead so playback starts at once).
 */
import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { media } from './support/media';
import { objectUrls, setupBrowser } from './support/browser';
import { settle, setupApp, freezeClock } from './support/app';
import { withAuth } from '../hooks/support/providers';
import { signInFakeUser } from '../fakes/firebase';
import { AppSettingsProvider, useAppSettings } from '../../src/contexts/AppSettingsContext';
import { useAudioPlayer } from '../../src/hooks/useAudioPlayer';
import { usePrefetchAudio } from '../../src/hooks/usePrefetchAudio';
import { playCardChime } from '../../src/lib/cardFeedback';
import { userDb } from '../../src/lib/offlineDb/userDb';
import { DEFAULT_APP_SETTINGS } from '../../src/types/appSettings';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));

media.setup();
setupBrowser();
setupApp();

let urlCounter = 0;
/** A fresh URL per call: the prefetch cache is shared by every test in the file. */
const freshUrl = (name: string) => `https://audio.test/${name}-${++urlCounter}.mp3`;

interface CardProps {
  cardId: string;
  audioUrl?: string;
  revealed?: boolean;
  autoPlayOnMount?: boolean;
  autoPlayOnReveal?: boolean;
}

async function renderCardAudio(initialProps: CardProps, { autoPlay = false } = {}) {
  signInFakeUser('reader');
  await userDb.userData.put({
    key: 'appSettings',
    data: { ...DEFAULT_APP_SETTINGS, autoPlayAudio: autoPlay },
    lastModified: Date.now(),
    pendingSync: 0,
  });
  const auth = withAuth('reader');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <auth.wrapper>
      <AppSettingsProvider>{children}</AppSettingsProvider>
    </auth.wrapper>
  );
  const hook = renderHook(
    ({ cardId, audioUrl, revealed, autoPlayOnMount, autoPlayOnReveal }: CardProps) => ({
      settings: useAppSettings(),
      audio: useAudioPlayer({ cardId, audioUrl, revealed, autoPlayOnMount, autoPlayOnReveal }),
    }),
    { wrapper, initialProps }
  );
  await settle();
  expect(hook.result.current.settings.loading).toBe(false);
  return hook;
}

const audioPlaying = () => media.playing().map((el) => el.getAttribute('src'));

describe('playing card audio', () => {
  test('plays the card audio and shows it as playing until it ends', async () => {
    const url = freshUrl('kot');
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: url });
    expect(result.current.audio.hasAudio).toBe(true);

    act(() => result.current.audio.playAudio());
    expect(audioPlaying()).toEqual([url]);
    expect(result.current.audio.isPlaying).toBe(true);

    media.finish(media.onlyPlaying());
    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('stop silences the audio and releases the element', async () => {
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('kot') });
    act(() => result.current.audio.playAudio());
    const el = media.onlyPlaying();

    act(() => result.current.audio.stopAudio());

    expect(el.paused).toBe(true);
    expect(el.hasAttribute('src')).toBe(false);
    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('toggle starts and stops the audio', async () => {
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('kot') });

    act(() => result.current.audio.toggleAudio());
    expect(media.playing()).toHaveLength(1);
    act(() => result.current.audio.toggleAudio());
    expect(media.playing()).toHaveLength(0);
    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('playing again restarts the audio instead of layering a second copy', async () => {
    const url = freshUrl('kot');
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: url });

    act(() => result.current.audio.playAudio());
    const first = media.onlyPlaying();
    act(() => result.current.audio.playAudio());

    expect(first.paused).toBe(true);
    expect(audioPlaying()).toEqual([url]);
    expect(media.onlyPlaying()).not.toBe(first);
  });

  test('a card without audio has nothing to play', async () => {
    const { result } = await renderCardAudio({ cardId: 'c1' });
    expect(result.current.audio.hasAudio).toBe(false);

    act(() => result.current.audio.playAudio());
    expect(media.playing()).toHaveLength(0);
    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('if the browser blocks playback the card does not stay "playing"', async () => {
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('kot') });
    media.blockPlay = true;

    act(() => result.current.audio.playAudio());
    await settle(1);

    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('if the audio fails to load the card does not stay "playing"', async () => {
    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('kot') });
    act(() => result.current.audio.playAudio());

    act(() => {
      media.onlyPlaying().dispatchEvent(new Event('error'));
    });

    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('moving to another card stops the previous card audio', async () => {
    const { result, rerender } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('a') });
    act(() => result.current.audio.playAudio());
    const el = media.onlyPlaying();

    rerender({ cardId: 'c2', audioUrl: freshUrl('b') });

    expect(el.paused).toBe(true);
    expect(media.playing()).toHaveLength(0);
    expect(result.current.audio.isPlaying).toBe(false);
  });

  test('leaving the page stops the audio', async () => {
    const { result, unmount } = await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('a') });
    act(() => result.current.audio.playAudio());
    const el = media.onlyPlaying();

    unmount();

    expect(el.paused).toBe(true);
  });
});

describe('auto-play', () => {
  test('plays when the card opens if auto-play is on', async () => {
    const url = freshUrl('auto');
    await renderCardAudio(
      { cardId: 'c1', audioUrl: url, autoPlayOnMount: true },
      { autoPlay: true }
    );
    expect(audioPlaying()).toEqual([url]);
  });

  test('stays quiet when auto-play is off', async () => {
    await renderCardAudio({ cardId: 'c1', audioUrl: freshUrl('auto'), autoPlayOnMount: true });
    expect(media.playing()).toHaveLength(0);
  });

  test('waits for a card-completion chime to finish before playing', async () => {
    // The chime's quiet period is module state that outlives the test; set it in the
    // past of any real clock so later tests (on real time) never wait for it.
    freezeClock('2020-01-01T12:00:00');
    playCardChime('good');
    await renderCardAudio(
      { cardId: 'c1', audioUrl: freshUrl('auto'), autoPlayOnMount: true },
      { autoPlay: true }
    );

    expect(media.playing()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(229));
    expect(media.playing()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    expect(media.playing()).toHaveLength(1);
  });

  test('plays once when the answer is revealed, not again on the same card', async () => {
    const first = freshUrl('reveal');
    const { result, rerender } = await renderCardAudio(
      { cardId: 'c1', audioUrl: first, autoPlayOnReveal: true, revealed: false },
      { autoPlay: true }
    );
    expect(media.playing()).toHaveLength(0);

    rerender({ cardId: 'c1', audioUrl: first, autoPlayOnReveal: true, revealed: true });
    await settle(1);
    expect(audioPlaying()).toEqual([first]);

    act(() => result.current.audio.stopAudio());
    rerender({ cardId: 'c1', audioUrl: first, autoPlayOnReveal: true, revealed: false });
    rerender({ cardId: 'c1', audioUrl: first, autoPlayOnReveal: true, revealed: true });
    await settle(1);
    expect(media.playing()).toHaveLength(0);

    const second = freshUrl('reveal');
    rerender({ cardId: 'c2', audioUrl: second, autoPlayOnReveal: true, revealed: true });
    await settle(1);
    expect(audioPlaying()).toEqual([second]);
  });
});

describe('prefetching', () => {
  const okResponse = () => ({ ok: true, blob: async () => new Blob(['audio']) });

  test('downloads each distinct URL once, skipping missing ones', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<ReturnType<typeof okResponse>>>(async () =>
      okResponse()
    );
    vi.stubGlobal('fetch', fetchMock);
    const [a, b, c] = [freshUrl('a'), freshUrl('b'), freshUrl('c')];

    const { rerender } = renderHook(({ urls }) => usePrefetchAudio(urls), {
      initialProps: { urls: [a, null, b, a, undefined, ''] as Array<string | null | undefined> },
    });
    await settle(2);
    rerender({ urls: [a, b] });
    rerender({ urls: [b, c] });
    await settle(2);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([a, b, c]);
  });

  test('card audio plays from the downloaded copy once it is in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse())
    );
    const url = freshUrl('pre');
    renderHook(() => usePrefetchAudio([url]));
    await settle(2);
    const blobUrl = objectUrls.created.at(-1);
    expect(blobUrl).toMatch(/^blob:/);

    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: url });
    act(() => result.current.audio.playAudio());

    expect(audioPlaying()).toEqual([blobUrl]);
  });

  test('if the download is refused it warms the browser cache with a hidden audio element', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    );
    const url = freshUrl('cors');
    renderHook(() => usePrefetchAudio([url]));
    await settle(2);

    const warmer = media.withSource(url);
    expect(media.state(warmer).loads).toBe(1);
    expect(warmer.preload).toBe('auto');
    expect(objectUrls.created).toEqual([]);
  });

  test('if the download fails the card still plays from the original URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    );
    const url = freshUrl('offline');
    renderHook(() => usePrefetchAudio([url]));
    await settle(2);

    const { result } = await renderCardAudio({ cardId: 'c1', audioUrl: url });
    act(() => result.current.audio.playAudio());

    expect(audioPlaying()).toEqual([url]);
  });
});

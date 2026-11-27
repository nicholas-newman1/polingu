/**
 * The audio player: AudioPlayerProvider driven through the library and player pages.
 * Audio elements are the fake from support/media.ts; time passes only through
 * media.play(ms), which advances the fake clock frame by frame.
 */
import { describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { media } from './support/media';
import { installMediaSession, objectUrls, setupBrowser } from './support/browser';
import {
  cacheAudioBlobFor,
  cachedAudioBlobKeys,
  goTo,
  player,
  queuePath,
  renderApp,
  seedLibrary,
  seedQueue,
  seedTracks,
  settle,
  setupApp,
  track,
  trackPath,
  trackUrl,
  freezeClock,
  waitUntil,
} from './support/app';
import { line } from './support/transcript';
import { storageServer } from './support/firebaseStorage';
import { callables } from './support/firebaseFunctions';
import { remote } from '../sync/support/fakeFirestore';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));

media.setup();
setupBrowser();
setupApp();

const NEWS = 'Morning news';
const WEATHER = 'Weather';
const SPORTS = 'Sports';

const NEWS_LINES = [
  line('Dzień dobry państwu', 0, 2.5),
  line('Oto najnowsze wiadomości', 3, 6),
  line('Do zobaczenia jutro', 8, 10),
];

/** Newest first, so the library lists them News, Weather, Sports. */
const LIBRARY = [
  track('t1', { title: NEWS, createdAt: 3000, transcript: NEWS_LINES }),
  track('t2', { title: WEATHER, createdAt: 2000, transcript: [line('Jutro będzie słońce', 0, 3)] }),
  track('t3', { title: SPORTS, createdAt: 1000, transcript: [line('Wyniki meczu', 0, 2)] }),
];

async function openLibrary(options: Parameters<typeof renderApp>[0] = {}) {
  freezeClock();
  await seedLibrary({ tracks: LIBRARY });
  renderApp(options);
  await waitUntil(() => screen.getByText(NEWS));
}

/** Taps a track in the library and lets it start. */
async function tapTrack(title: string) {
  fireEvent.click(screen.getAllByText(title)[0]);
  await settle();
}

async function openPlayerWith(title = NEWS) {
  await openLibrary();
  await tapTrack(title);
  goTo('/audio/player');
  await settle();
}

// --- Player page controls -------------------------------------------------------

const controls = () => screen.getByRole('button', { name: 'Next track' }).parentElement!;
const playPauseButton = () => within(controls()).getAllByRole('button')[2];
const showsPause = () => within(controls()).queryByTestId('PauseIcon') !== null;
const progress = () => screen.getAllByRole('slider')[0] as HTMLInputElement;
/** The position and length shown under the progress bar. */
const shownTime = () => {
  const row = progress().closest('.MuiSlider-root')!.parentElement!.nextElementSibling!;
  return [...row.children].map((c) => c.textContent);
};
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

/** The transcript lines, as rendered rows. */
const transcriptRows = () =>
  screen
    .getAllByRole('button', { name: 'Jump to this line' })
    .map((button) => button.parentElement!.parentElement!);
const highlighted = () =>
  transcriptRows()
    .filter((row) => getComputedStyle(row).opacity === '1')
    .map((row) => row.textContent);

const playing = () => media.onlyPlaying().getAttribute('src');

// --- Mini player on the library page -------------------------------------------

const miniPlayer = () => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/).parentElement!.parentElement!;
const miniPlayerTime = () => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/).textContent;

describe('starting a track from the library', () => {
  test('tapping a track plays it and shows the mini player with its title and length', async () => {
    await openLibrary();
    await tapTrack(NEWS);

    expect(playing()).toBe(trackUrl('t1'));
    expect(within(miniPlayer()).getByText(NEWS)).toBeInTheDocument();
    expect(miniPlayerTime()).toBe('0:00 / 1:40');
    expect(within(miniPlayer()).getByTestId('PauseIcon')).toBeInTheDocument();
  });

  test('the queue continues with the tracks after it, in library order', async () => {
    await openLibrary();
    await tapTrack(WEATHER);

    expect(player().autoQueue).toEqual(['t3']);
    expect(remote.get(queuePath)).toMatchObject({ currentTrackId: 't2', autoQueue: ['t3'] });
  });

  test('tapping the playing track pauses it, and tapping again resumes', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const el = media.withSource(trackUrl('t1'));

    await tapTrack(NEWS);
    expect(el.paused).toBe(true);
    expect(within(miniPlayer()).getByTestId('PlayArrowIcon')).toBeInTheDocument();

    await tapTrack(NEWS);
    expect(el.paused).toBe(false);
  });

  test('the mini player play button pauses and resumes', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const el = media.withSource(trackUrl('t1'));

    fireEvent.click(within(miniPlayer()).getByRole('button', { name: 'Pause' }));
    expect(el.paused).toBe(true);
    fireEvent.click(within(miniPlayer()).getByRole('button', { name: 'Play' }));
    expect(el.paused).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/audio');
  });

  test('tapping the mini player opens the full player', async () => {
    await openLibrary();
    await tapTrack(NEWS);

    fireEvent.click(within(miniPlayer()).getByText(NEWS));
    expect(screen.getByTestId('location')).toHaveTextContent('/audio/player');
    expect(screen.getByRole('button', { name: 'Next track' })).toBeInTheDocument();
  });

  test('works the same under StrictMode', async () => {
    await openLibrary({ strict: true });
    await tapTrack(NEWS);
    expect(playing()).toBe(trackUrl('t1'));

    goTo('/audio/player');
    click('Next track');
    await settle();
    expect(playing()).toBe(trackUrl('t2'));
    // The shown time is published at most every 200 ms.
    media.play(1_300);
    expect(shownTime()[0]).toBe('0:01');

    click('Previous track');
    await settle();
    expect(playing()).toBe(trackUrl('t1'));
    expect(transcriptRows()).toHaveLength(3);
  });

  test('playback carries on while browsing other pages', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const el = media.withSource(trackUrl('t1'));

    goTo('/dashboard');
    media.play(5300);
    expect(el.paused).toBe(false);

    goTo('/audio');
    expect(miniPlayerTime()).toBe('0:05 / 1:40');
  });
});

describe('player page controls', () => {
  test('the play button pauses and resumes the track', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    expect(showsPause()).toBe(true);

    fireEvent.click(within(controls()).getByRole('button', { name: 'Pause' }));
    expect(el.paused).toBe(true);
    expect(showsPause()).toBe(false);

    fireEvent.click(within(controls()).getByRole('button', { name: 'Play' }));
    expect(el.paused).toBe(false);
    expect(showsPause()).toBe(true);
  });

  test('the time display keeps up with the audio while it plays', async () => {
    await openPlayerWith(NEWS);
    expect(shownTime()).toEqual(['0:00', '1:40']);

    media.play(10_300);
    expect(shownTime()).toEqual(['0:10', '1:40']);

    media.play(5_000);
    expect(shownTime()[0]).toBe('0:15');
    expect(Number(progress().value)).toBeCloseTo(15.3, 0);
  });

  test('pausing shows the exact position the audio stopped at', async () => {
    await openPlayerWith(NEWS);
    media.play(12_700);

    fireEvent.click(playPauseButton());
    expect(shownTime()[0]).toBe('0:12');
    expect(Number(progress().getAttribute('aria-valuenow'))).toBeCloseTo(12.7, 5);
  });

  test('skip back and ahead move ten seconds, without leaving the track', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    media.play(5_000);

    click('Skip back 10 seconds');
    expect(el.currentTime).toBe(0);
    expect(shownTime()[0]).toBe('0:00');

    click('Skip ahead 10 seconds');
    expect(el.currentTime).toBe(10);
    expect(shownTime()[0]).toBe('0:10');

    fireEvent.click(playPauseButton());
    media.moveTo(el, 95);
    click('Skip ahead 10 seconds');
    expect(el.currentTime).toBe(100);
    expect(shownTime()[0]).toBe('1:40');
  });

  test('dragging the progress bar seeks, and a playing track keeps playing', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    fireEvent.change(progress(), { target: { value: '42' } });

    expect(el.currentTime).toBe(42);
    expect(el.paused).toBe(false);
    expect(shownTime()[0]).toBe('0:42');
  });

  test('dragging the progress bar of a paused track seeks without starting it', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    fireEvent.click(playPauseButton());

    fireEvent.change(progress(), { target: { value: '30' } });

    expect(el.currentTime).toBe(30);
    expect(el.paused).toBe(true);
    expect(shownTime()[0]).toBe('0:30');
  });

  test('the speed control changes how fast the audio plays, and the buffered next track keeps it', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    click('Playback speed 1x');
    fireEvent.change(within(screen.getByRole('menu')).getByRole('slider'), {
      target: { value: '1.5' },
    });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(el.playbackRate).toBe(1.5);
    expect(screen.getByRole('button', { name: 'Playback speed 1.5x' })).toBeInTheDocument();

    media.play(2_000);
    expect(el.currentTime).toBeCloseTo(3, 5);

    click('Next track');
    await settle();
    expect(media.withSource(trackUrl('t2')).playbackRate).toBe(1.5);
  });

  test('the chosen speed also applies to a track that was not buffered', async () => {
    await openPlayerWith(NEWS);
    click('Playback speed 1x');
    fireEvent.change(within(screen.getByRole('menu')).getByRole('slider'), {
      target: { value: '1.5' },
    });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    goTo('/audio');
    await tapTrack(SPORTS);
    goTo('/audio/player');

    expect(playing()).toBe(trackUrl('t3'));
    expect(screen.getByRole('button', { name: 'Playback speed 1.5x' })).toBeInTheDocument();
    expect(media.onlyPlaying().playbackRate).toBe(1.5);
  });

  test('next plays the following track and previous goes back to it', async () => {
    await openPlayerWith(NEWS);
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeDisabled();

    click('Next track');
    await settle();
    expect(playing()).toBe(trackUrl('t2'));
    expect(transcriptRows().map((r) => r.textContent)).toEqual(['Jutro będzie słońce']);
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeEnabled();

    click('Previous track');
    await settle();
    expect(playing()).toBe(trackUrl('t1'));
    expect(transcriptRows()).toHaveLength(3);
  });

  test('previous restarts the current track when more than three seconds in', async () => {
    await openPlayerWith(NEWS);
    click('Next track');
    await settle();
    const el = media.withSource(trackUrl('t2'));
    media.play(4_000);

    click('Previous track');
    await settle();

    expect(playing()).toBe(trackUrl('t2'));
    expect(el.currentTime).toBe(0);
    expect(shownTime()[0]).toBe('0:00');
  });

  test('previous starts the previous track from the beginning', async () => {
    await openPlayerWith(NEWS);
    media.play(50_000);
    click('Next track');
    await settle();

    click('Previous track');
    await settle();

    expect(playing()).toBe(trackUrl('t1'));
    expect(media.onlyPlaying().currentTime).toBe(0);
  });

  test('next is disabled on the last track of the queue', async () => {
    await openLibrary();
    await tapTrack(SPORTS);
    goTo('/audio/player');
    expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled();
  });

  test('when a track ends the next one starts by itself', async () => {
    media.durations.set(trackUrl('t1'), 3);
    await openPlayerWith(NEWS);

    media.play(3_100);
    await settle();

    expect(playing()).toBe(trackUrl('t2'));
    expect(showsPause()).toBe(true);
  });

  test('when the last track ends playback stops at its end', async () => {
    media.durations.set(trackUrl('t3'), 2);
    await openLibrary();
    await tapTrack(SPORTS);
    goTo('/audio/player');

    media.play(2_100);
    await settle();

    expect(media.playing()).toHaveLength(0);
    expect(showsPause()).toBe(false);
    expect(shownTime()).toEqual(['0:02', '0:02']);
  });

  test('the space bar toggles playback, but not while typing in a field', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(el.paused).toBe(true);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(el.paused).toBe(false);

    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: ' ', code: 'Space' });
    expect(el.paused).toBe(false);
    field.remove();
  });
});

describe('transcript', () => {
  test('the line being spoken is highlighted and scrolled into view as playback moves', async () => {
    await openPlayerWith(NEWS);
    media.play(500);
    expect(highlighted()).toEqual(['Dzień dobry państwu']);

    media.play(3_000);
    expect(highlighted()).toEqual(['Oto najnowsze wiadomości']);
    const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1);
    expect(scrolled).toBe(transcriptRows()[1]);
  });

  test('the highlight moves half a second ahead of the audio, and leaves gaps unlit', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    fireEvent.click(playPauseButton());

    fireEvent.change(progress(), { target: { value: '7' } });
    expect(highlighted()).toEqual([]);

    seekAudio(el, 7.6);
    expect(highlighted()).toEqual(['Do zobaczenia jutro']);
  });

  test('the active word follows the audio within the line', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    fireEvent.click(playPauseButton());

    // "Oto najnowsze wiadomości" spans 3-6 s, a second per word; highlight leads by 0.5 s.
    seekAudio(el, 3.6);
    expect([player().activeSegmentIndex, player().activeWordIndex]).toEqual([1, 1]);
    seekAudio(el, 4.6);
    expect([player().activeSegmentIndex, player().activeWordIndex]).toEqual([1, 2]);
  });

  test('"Jump to this line" starts playback just before the line', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    fireEvent.click(playPauseButton());

    fireEvent.click(within(transcriptRows()[2]).getByRole('button', { name: 'Jump to this line' }));

    expect(el.currentTime).toBeCloseTo(7.8, 5);
    expect(el.paused).toBe(false);
    expect(highlighted()).toEqual(['Do zobaczenia jutro']);
  });

  test('a track without a transcript says so', async () => {
    freezeClock();
    await seedLibrary({ tracks: [track('bare', { title: 'No words' })] });
    renderApp();
    await waitUntil(() => screen.getByText('No words'));
    await tapTrack('No words');
    goTo('/audio/player');
    expect(screen.getByText('No transcript available')).toBeInTheDocument();
  });
});

/** Moves the audio as a seek from outside the page would (lock screen, headset). */
function seekAudio(el: HTMLMediaElement, time: number) {
  act(() => {
    el.currentTime = time;
  });
}

describe('player page states', () => {
  test('with nothing playing the player page sends you to the library', async () => {
    await openLibrary({ route: '/audio/player' });
    expect(screen.getByTestId('location')).toHaveTextContent('/audio');
    expect(screen.queryByRole('button', { name: 'Next track' })).not.toBeInTheDocument();
  });

  test('shows a spinner while the track is being fetched', async () => {
    await openLibrary();
    fireEvent.click(screen.getByText(NEWS));
    goTo('/audio/player');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await settle();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(transcriptRows()).toHaveLength(3);
  });

  test('says so when the audio file cannot be fetched', async () => {
    await openLibrary();
    storageServer.offline = true;
    await tapTrack(NEWS);
    goTo('/audio/player');
    expect(screen.getByText('Failed to load audio file.')).toBeInTheDocument();
  });

  test('after a track fails to load, picking another one plays it', async () => {
    await openLibrary();
    storageServer.offline = true;
    await tapTrack(NEWS);
    goTo('/audio/player');
    expect(screen.getByText('Failed to load audio file.')).toBeInTheDocument();

    storageServer.offline = false;
    goTo('/audio');
    await tapTrack(WEATHER);
    goTo('/audio/player');

    expect(screen.queryByText('Failed to load audio file.')).not.toBeInTheDocument();
    expect(playing()).toBe(trackUrl('t2'));
    expect(transcriptRows().map((r) => r.textContent)).toEqual(['Jutro będzie słońce']);
  });

  test('skipping to a track deleted on another device says it is gone and stops the audio', async () => {
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));
    remote.remove(`users/listener-1/audioItems/t2`);
    await settle();

    click('Next track');
    await settle();

    expect(screen.getByText('Audio item not found.')).toBeInTheDocument();
    expect(el.paused).toBe(true);
    expect(media.playing()).toHaveLength(0);
  });

  test('skipping to a track whose processing failed shows the reason', async () => {
    await openPlayerWith(NEWS);
    seedTracks({ ...LIBRARY[1], status: 'error', error: 'Could not transcribe' });
    await settle();

    click('Next track');
    await settle();

    expect(screen.getByText('Could not transcribe')).toBeInTheDocument();
  });

  test('a queued track still being processed shows progress and plays once it is ready', async () => {
    await openPlayerWith(NEWS);
    seedTracks({ ...LIBRARY[1], status: 'processing' });
    await settle();

    click('Next track');
    await settle();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(media.playing()).toHaveLength(0);

    seedTracks(LIBRARY[1]);
    await settle();
    expect(playing()).toBe(trackUrl('t2'));
    expect(transcriptRows().map((r) => r.textContent)).toEqual(['Jutro będzie słońce']);
  });

  test('choosing a track that cannot be fetched stops the one that was playing', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const el = media.withSource(trackUrl('t1'));
    storageServer.offline = true;

    await tapTrack(SPORTS);
    goTo('/audio/player');
    expect(screen.getByText('Failed to load audio file.')).toBeInTheDocument();

    expect(el.paused).toBe(true);
  });
});

describe('remembering the position', () => {
  test('while playing, the position is saved to the server every 30 seconds', async () => {
    await openPlayerWith(NEWS);
    media.play(29_000);
    await settle();
    expect(remote.get(queuePath)?.savedTime).toBe(0);

    media.play(1_100);
    await settle();
    expect(remote.get(queuePath)?.savedTime).toBeCloseTo(30, 0);
  });

  test('pausing saves the position at once, on this device and on the server', async () => {
    await openPlayerWith(NEWS);
    media.play(12_500);

    fireEvent.click(playPauseButton());
    await settle();

    expect(remote.get(queuePath)?.savedTime).toBeCloseTo(12.5, 5);
    // The copy on the device is written at most once a second of playback.
    const local = JSON.parse(localStorage.getItem('polingu.audioSavedTime')!);
    expect(local.trackId).toBe('t1');
    expect(Math.abs(local.time - 12.5)).toBeLessThanOrEqual(1);
  });

  test('hiding or leaving the page saves the position', async () => {
    await openPlayerWith(NEWS);
    media.play(8_000);

    // Restored after the test by restoreMocks.
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await settle();
    expect(remote.get(queuePath)?.savedTime).toBeCloseTo(8, 5);

    visibility.mockReturnValue('visible');
    media.play(4_000);
    fireEvent(window, new Event('pagehide'));
    await settle();
    expect(remote.get(queuePath)?.savedTime).toBeCloseTo(12, 5);
  });

  test('reopening the app brings back the last track at the saved position, paused', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    seedQueue({ currentTrackId: 't2', autoQueue: ['t3'], history: ['t1'], savedTime: 42 });

    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();

    expect(within(miniPlayer()).getByText(WEATHER)).toBeInTheDocument();
    expect(miniPlayerTime()).toBe('0:42 / 1:40');
    const el = media.withSource(trackUrl('t2'));
    expect(el.currentTime).toBe(42);
    expect(el.paused).toBe(true);

    fireEvent.click(within(miniPlayer()).getByTestId('PlayArrowIcon').closest('button')!);
    expect(el.paused).toBe(false);
    expect(el.currentTime).toBe(42);
  });

  test('a position saved on this device after the last server save wins', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    seedQueue({ currentTrackId: 't1', autoQueue: ['t2'], savedTime: 42, updatedAt: 1000 });
    localStorage.setItem(
      'polingu.audioSavedTime',
      JSON.stringify({ trackId: 't1', time: 57, updatedAt: 2000 })
    );

    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();

    expect(miniPlayerTime()).toBe('0:57 / 1:40');
  });

  test('the server position wins over an older one on this device or one for another track', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    seedQueue({ currentTrackId: 't1', autoQueue: ['t2'], savedTime: 42, updatedAt: 2000 });
    localStorage.setItem(
      'polingu.audioSavedTime',
      JSON.stringify({ trackId: 't1', time: 57, updatedAt: 1000 })
    );

    const { unmount } = renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();
    expect(miniPlayerTime()).toBe('0:42 / 1:40');
    unmount();
    await settle();

    seedQueue({ currentTrackId: 't1', autoQueue: ['t2'], savedTime: 42, updatedAt: 1000 });
    localStorage.setItem(
      'polingu.audioSavedTime',
      JSON.stringify({ trackId: 't2', time: 57, updatedAt: 2000 })
    );
    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();
    expect(miniPlayerTime()).toBe('0:42 / 1:40');
  });

  test('a saved position beyond the end of the track starts it from the beginning', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    seedQueue({ currentTrackId: 't1', savedTime: 500 });

    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();

    expect(miniPlayerTime()).toBe('0:00 / 1:40');
    expect(media.withSource(trackUrl('t1')).currentTime).toBe(0);
  });

  test('moving on to a track still being processed does not give it the old track’s position', async () => {
    await openPlayerWith(NEWS);
    seedTracks({ ...LIBRARY[1], status: 'processing' });
    await settle();
    media.moveTo(media.onlyPlaying(), 50);
    media.play(100);

    click('Next track');
    await settle();
    expect(remote.get(queuePath)).toMatchObject({ currentTrackId: 't2', savedTime: 0 });

    // Once the track is ready, close the app and open it again.
    seedTracks(LIBRARY[1]);
    await settle();
    cleanup();
    await settle();
    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();
    expect(within(miniPlayer()).getByText(WEATHER)).toBeInTheDocument();
    expect(miniPlayerTime()).toBe('0:00 / 1:40');
  });

  test('after reopening on a finished track, the next track picked starts at the beginning', async () => {
    media.durations.set(trackUrl('t3'), 30);
    media.durations.set(trackUrl('t1'), 300);
    await openLibrary();
    await tapTrack(SPORTS);
    media.moveTo(media.onlyPlaying(), 29.5);
    media.play(600);
    await settle();
    expect(media.playing()).toHaveLength(0);
    expect(remote.get(queuePath)?.savedTime).toBe(30);

    // Close the app and open it again.
    cleanup();
    await settle();
    renderApp();
    await waitUntil(() => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/));
    await settle();
    expect(miniPlayerTime()).toBe('0:00 / 0:30');

    await tapTrack(NEWS);
    expect(playing()).toBe(trackUrl('t1'));
    expect(media.onlyPlaying().currentTime).toBe(0);
  });
});

describe('lock screen and headset controls', () => {
  test('show the playing track title, and follow track changes', async () => {
    const session = installMediaSession();
    await openPlayerWith(NEWS);
    expect(session.metadata).toMatchObject({ title: NEWS, artist: 'Polingu' });

    click('Next track');
    await settle();
    expect(session.metadata).toMatchObject({ title: WEATHER });
  });

  test('play, pause, next and previous control the player', async () => {
    const session = installMediaSession();
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    act(() => session.trigger('pause'));
    expect(el.paused).toBe(true);
    act(() => session.trigger('play'));
    expect(el.paused).toBe(false);

    act(() => session.trigger('nexttrack'));
    await settle();
    expect(playing()).toBe(trackUrl('t2'));

    // The handlers act on whichever element is now playing.
    act(() => session.trigger('pause'));
    expect(media.playing()).toHaveLength(0);

    act(() => session.trigger('previoustrack'));
    await settle();
    expect(playing()).toBe(trackUrl('t1'));
  });

  test('seeking from the lock screen moves the position; skips stay within the track', async () => {
    const session = installMediaSession();
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    act(() => session.trigger('seekto', { seekTime: 61 }));
    expect(el.currentTime).toBe(61);
    expect(shownTime()[0]).toBe('1:01');

    act(() => session.trigger('seekbackward'));
    expect(el.currentTime).toBe(51);
    act(() => session.trigger('seekforward'));
    expect(el.currentTime).toBe(61);

    el.currentTime = 4;
    act(() => session.trigger('seekbackward'));
    expect(el.currentTime).toBe(0);
    el.currentTime = 95;
    act(() => session.trigger('seekforward'));
    expect(el.currentTime).toBe(100);
  });

  test('the lock-screen progress bar gets the position, length and speed', async () => {
    const session = installMediaSession();
    await openPlayerWith(NEWS);
    media.play(20_000);

    click('Playback speed 1x');
    fireEvent.change(within(screen.getByRole('menu')).getByRole('slider'), {
      target: { value: '2' },
    });

    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 100,
      playbackRate: 2,
      position: expect.closeTo(20, 5),
    });
  });
});

describe('buffering and offline playback', () => {
  test('the next track is buffered while one plays, so skipping starts it at once', async () => {
    await openPlayerWith(NEWS);
    const buffered = media.withSource(trackUrl('t2'));
    expect(media.state(buffered).readyState).toBe(4);
    const requests = storageServer.requested.length;
    const loads = media.state(buffered).loads;

    click('Next track');

    expect(buffered.paused).toBe(false);
    expect(media.state(buffered).loads).toBe(loads);
    expect(storageServer.requested.length).toBe(requests);
  });

  test('a track cached on the device plays without asking the server for it', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    await cacheAudioBlobFor('t1');
    renderApp();
    await waitUntil(() => screen.getByText(NEWS));

    await tapTrack(NEWS);

    expect(media.onlyPlaying().getAttribute('src')).toMatch(/^blob:/);
    expect(storageServer.requested).not.toContain(trackPath('t1'));
  });

  test('a downloaded track is kept on the device for next time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => 'audio-bytes' }))
    );
    await openLibrary();
    await tapTrack(NEWS);

    await settle();
    expect(fetch).toHaveBeenCalledWith(trackUrl('t1'));
    expect(await cachedAudioBlobKeys()).toContain('t1');
  });
});

describe('library updates while playing', () => {
  test('renaming the playing track on another device updates the mini player', async () => {
    await openLibrary();
    await tapTrack(NEWS);

    seedTracks({ ...LIBRARY[0], title: 'Evening news' });
    await settle();

    expect(within(miniPlayer()).getByText('Evening news')).toBeInTheDocument();
  });

  test('offline, the library shows the copy kept on the device', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    remote.offline = true;

    renderApp();
    await waitUntil(() => screen.getByText(SPORTS));

    expect(screen.getByText('3 audios')).toBeInTheDocument();
  });

  test('the device copy shows first, then the server list replaces it', async () => {
    // The fake Firestore answers on a microtask, before any IndexedDB read; the real SDK
    // answers from the server only after its own cache reads and a network round trip.
    // Holding the server back models that order.
    freezeClock();
    await seedLibrary({ tracks: [LIBRARY[0]] });
    seedTracks(LIBRARY[1]);
    remote.offline = true;

    renderApp();
    await waitUntil(() => screen.getByText(NEWS));
    expect(screen.getByText('1 audios')).toBeInTheDocument();

    remote.reconnect();
    await settle();

    expect(screen.getByText(WEATHER)).toBeInTheDocument();
    expect(screen.getByText('2 audios')).toBeInTheDocument();
  });
});

describe('reading along', () => {
  test('tapping a word pauses the audio and translates it in the context of its line', async () => {
    callables.handle = async (name) =>
      name === 'translate'
        ? { data: { translatedText: 'good', charsUsedToday: 4, resetTime: '' } }
        : { data: {} };
    await openPlayerWith(NEWS);
    const el = media.withSource(trackUrl('t1'));

    fireEvent.click(within(transcriptRows()[0]).getByText('dobry'));
    await settle();

    expect(el.paused).toBe(true);
    expect(callables.calls).toHaveBeenCalledWith(
      'translate',
      expect.objectContaining({ text: 'dobry', targetLang: 'EN', context: 'Dzień dobry państwu' })
    );
    await waitUntil(() => screen.getByText('good'));
  });

  test('the text size menu resizes the transcript and is remembered', async () => {
    await openPlayerWith(NEWS);
    const sizeOf = () => parseFloat(getComputedStyle(transcriptRows()[0]).fontSize);
    const large = sizeOf();

    click('Change font size');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Small' }));
    act(() => vi.advanceTimersByTime(500));

    expect(sizeOf()).toBeLessThan(large);
    expect(localStorage.getItem('polingu_transcriptFontSize')).toBe('small');
    click('Change font size');
    expect(
      within(screen.getByRole('menuitem', { name: 'Small' })).getByTestId('CheckIcon')
    ).toBeInTheDocument();
  });

  test('long transcripts render lines as they come near, and always the line being spoken', async () => {
    const observers: Array<{ callback: IntersectionObserverCallback; targets: Element[] }> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private entry: { callback: IntersectionObserverCallback; targets: Element[] };
        constructor(callback: IntersectionObserverCallback) {
          this.entry = { callback, targets: [] };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        disconnect() {
          this.entry.targets = [];
        }
      }
    );
    const lines = Array.from({ length: 20 }, (_, i) =>
      line(`Zdanie numer ${i}`, 2 * i, 2 * i + 1.5)
    );
    freezeClock();
    await seedLibrary({ tracks: [track('long', { title: 'Long talk', transcript: lines })] });
    renderApp();
    await waitUntil(() => screen.getByText('Long talk'));
    await tapTrack('Long talk');
    goTo('/audio/player');
    await settle();

    expect(transcriptRows().map((r) => r.textContent)).toEqual(
      lines.slice(0, 5).map((l) => l.text)
    );

    fireEvent.change(progress(), { target: { value: '30' } });
    expect(highlighted()).toEqual(['Zdanie numer 15']);
    expect(transcriptRows()).toHaveLength(6);

    act(() => {
      for (const { callback, targets } of observers) {
        for (const target of targets) {
          callback(
            [{ target, isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        }
      }
    });
    expect(transcriptRows()).toHaveLength(20);
  });
});

describe('more player states', () => {
  test('a saved track that is no longer in the library is not brought back', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    seedQueue({ currentTrackId: 'deleted', savedTime: 42 });

    renderApp();
    await waitUntil(() => screen.getByText(NEWS));
    await settle();

    expect(screen.queryByText(/^\d+:\d\d \/ \d+:\d\d$/)).not.toBeInTheDocument();
    expect(media.playing()).toHaveLength(0);
  });

  test('if the playing track is sent back for processing the player says it is transcribing', async () => {
    await openPlayerWith(NEWS);

    seedTracks({ ...LIBRARY[0], status: 'processing' });
    await settle();

    expect(screen.getByText('Transcribing audio...')).toBeInTheDocument();
  });

  test('a queued track that finishes processing while offline reports that it cannot load', async () => {
    await openPlayerWith(NEWS);
    seedTracks({ ...LIBRARY[2], status: 'processing' });
    await settle();
    click('Next track');
    await settle();
    click('Next track');
    await settle();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    storageServer.offline = true;
    seedTracks(LIBRARY[2]);
    await settle();

    expect(screen.getByText('Failed to load audio file.')).toBeInTheDocument();
  });

  test('a track played again in the same visit reuses the copy already in memory', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    await cacheAudioBlobFor('t1');
    await cacheAudioBlobFor('t3');
    renderApp();
    await waitUntil(() => screen.getByText(NEWS));

    await tapTrack(NEWS);
    const firstUrl = media.onlyPlaying().getAttribute('src');
    expect(firstUrl).toMatch(/^blob:/);
    await tapTrack(SPORTS);
    const created = objectUrls.created.length;
    await tapTrack(NEWS);

    expect(media.onlyPlaying().getAttribute('src')).toBe(firstUrl);
    expect(objectUrls.created).toHaveLength(created);
    expect(objectUrls.revoked).not.toContain(firstUrl);
  });

  test('at most 20 tracks are kept in memory, and never the one playing is dropped', async () => {
    const many = Array.from({ length: 22 }, (_, i) =>
      track(`m${i}`, { title: `Episode ${i}`, createdAt: 10_000 - i })
    );
    freezeClock();
    await seedLibrary({ tracks: many });
    for (const item of many) await cacheAudioBlobFor(item.id);
    renderApp();
    await waitUntil(() => screen.getByText('Episode 0'));

    await tapTrack('Episode 0');
    goTo('/audio/player');
    const firstUrl = media.onlyPlaying().getAttribute('src')!;
    for (let i = 1; i < many.length; i++) {
      click('Next track');
      await settle();
      expect(objectUrls.revoked).not.toContain(media.onlyPlaying().getAttribute('src'));
    }

    expect(objectUrls.created.length - objectUrls.revoked.length).toBe(20);
    expect(objectUrls.revoked).toContain(firstUrl);
  });
});

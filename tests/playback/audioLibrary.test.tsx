/**
 * The audio library page: the track list, the per-track menu and dialogs, the mini
 * player and the queue drawer it opens.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { media } from './support/media';
import { setupBrowser } from './support/browser';
import {
  player,
  queuePath,
  renderApp,
  seedLibrary,
  seedSystemTracks,
  seedTracks,
  settle,
  setupApp,
  snackbar,
  systemTrack,
  track,
  trackUrl,
  UID,
  freezeClock,
  waitUntil,
} from './support/app';
import { line } from './support/transcript';
import { callables } from './support/firebaseFunctions';
import { storageServer } from './support/firebaseStorage';
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
const POEM = 'Poem of the day';

const LIBRARY = [
  track('t1', {
    title: NEWS,
    createdAt: Date.UTC(2026, 2, 9),
    duration: 75,
    transcript: [line('Dzień dobry', 0, 1), line('Oto wiadomości', 2, 3)],
  }),
  track('t2', { title: WEATHER, createdAt: Date.UTC(2026, 2, 7), duration: 61 }),
  track('t3', { title: SPORTS, createdAt: Date.UTC(2026, 2, 5), duration: 125 }),
];
const SYSTEM = [systemTrack('s1', { title: POEM, createdAt: Date.UTC(2026, 2, 8), duration: 30 })];

async function openLibrary(
  library: Parameters<typeof seedLibrary>[0] = { tracks: LIBRARY, systemTracks: SYSTEM },
  options: Parameters<typeof renderApp>[0] = {}
) {
  freezeClock();
  await seedLibrary(library);
  renderApp(options);
  await waitUntil(() => screen.getByText(/\d+ audios$/));
  await settle();
}

const rowOf = (title: string) => screen.getAllByText(title)[0].parentElement!.parentElement!;
const rowTitles = () =>
  screen
    .getAllByTestId('MoreVertIcon')
    .map((icon) => icon.closest('button')!.parentElement!)
    .filter((row) => row.closest('.MuiCard-root'))
    .map((row) => row.querySelector('p')!.textContent);

async function tapTrack(title: string) {
  fireEvent.click(screen.getAllByText(title)[0]);
  await settle();
}

function openMenuFor(title: string) {
  fireEvent.click(within(rowOf(title)).getByTestId('MoreVertIcon').closest('button')!);
  return screen.getByRole('menu');
}

function chooseMenuItem(name: RegExp) {
  fireEvent.click(screen.getByRole('menuitem', { name }));
  act(() => vi.advanceTimersByTime(500));
}

const miniPlayer = () => screen.getByText(/^\d+:\d\d \/ \d+:\d\d$/).parentElement!.parentElement!;

function openQueue() {
  fireEvent.click(within(miniPlayer()).getByTestId('MoreVertIcon').closest('button')!);
  return screen.getByText('Queue').closest('.MuiDrawer-paper') as HTMLElement;
}

describe('the track list', () => {
  test('lists ready tracks newest first, with length, date and a System tag', async () => {
    await openLibrary();

    expect(rowTitles()).toEqual([NEWS, POEM, WEATHER, SPORTS]);
    expect(screen.getByText('4 audios')).toBeInTheDocument();
    expect(within(rowOf(NEWS)).getByText('1:15')).toBeInTheDocument();
    expect(within(rowOf(NEWS)).getByText('Mar 8')).toBeInTheDocument();
    expect(within(rowOf(POEM)).getByText('System')).toBeInTheDocument();
    expect(within(rowOf(NEWS)).queryByText('System')).not.toBeInTheDocument();
  });

  test('shows a spinner until the library has loaded', async () => {
    freezeClock();
    await seedLibrary({ tracks: LIBRARY });
    renderApp();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitUntil(() => screen.getByText(NEWS));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('an older copy on the device, read after the server lists arrive, does not replace them', async () => {
    // The fake Firestore answers before IndexedDB, so here the device copy is read last.
    freezeClock();
    await seedLibrary({ tracks: [LIBRARY[0]] });
    seedTracks(LIBRARY[1]);
    seedSystemTracks(...SYSTEM);

    renderApp();
    await waitUntil(() => screen.getByText(/\d+ audios$/));
    await settle();

    expect(rowTitles()).toEqual([NEWS, POEM, WEATHER]);
  });

  test('tracks still processing are listed separately with what is happening', async () => {
    await openLibrary({
      tracks: [
        ...LIBRARY,
        track('up', { title: 'Lecture', status: 'processing', fileName: 'lecture.mp3' }),
        track('gen', { title: 'Generated', status: 'processing', fileSize: 0 }),
      ],
    });

    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(within(rowOf('Lecture')).getByText('lecture.mp3')).toBeInTheDocument();
    expect(
      within(rowOf('Generated')).getByText('Generating audio & transcript...')
    ).toBeInTheDocument();
    expect(rowTitles()).not.toContain('Lecture');
  });

  test('failed tracks show why; failed system tracks only to admins', async () => {
    const library = {
      tracks: [
        track('bad', { title: 'Broken upload', status: 'error' as const, error: 'Bad file' }),
      ],
      systemTracks: [systemTrack('sbad', { title: 'Broken system', status: 'error' as const })],
    };
    await openLibrary(library);
    expect(within(rowOf('Broken upload')).getByText('Bad file')).toBeInTheDocument();
    expect(screen.queryByText('Broken system')).not.toBeInTheDocument();
  });

  test('admins also see failed system tracks', async () => {
    const library = {
      systemTracks: [systemTrack('sbad', { title: 'Broken system', status: 'error' as const })],
    };
    await openLibrary(library, { isAdmin: true });
    expect(within(rowOf('Broken system')).getByText('Processing failed')).toBeInTheDocument();
  });

  test('an empty library explains how to add audio', async () => {
    await openLibrary({});
    expect(screen.getByText('No audios yet')).toBeInTheDocument();
    expect(screen.getByText('0 audios')).toBeInTheDocument();
  });

  test('the tapped track shows a spinner while it loads, then a pause icon', async () => {
    await openLibrary();
    fireEvent.click(screen.getByText(WEATHER));
    expect(within(rowOf(WEATHER)).getByRole('progressbar')).toBeInTheDocument();

    await settle();
    expect(within(rowOf(WEATHER)).getByTestId('PauseIcon')).toBeInTheDocument();
    expect(within(rowOf(NEWS)).getByTestId('PlayArrowIcon')).toBeInTheDocument();
  });

  test('a system track plays like any other', async () => {
    await openLibrary();
    await tapTrack(POEM);
    expect(media.onlyPlaying().getAttribute('src')).toBe('https://storage.test/systemAudio/s1.mp3');
    expect(player().autoQueue).toEqual(['t2', 't3']);
  });
});

describe('track menu', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  test('"Play Next" puts the track first in the queue, ahead of the rest of the library', async () => {
    await openLibrary();
    await tapTrack(NEWS);

    openMenuFor(SPORTS);
    chooseMenuItem(/Play Next/);

    expect(snackbar).toHaveBeenLastCalledWith('Playing next', 'success');
    expect(player().userQueue).toEqual(['t3']);
    await settle();
    expect(remote.get(queuePath)?.userQueue).toEqual(['t3']);

    act(() => player().nextTrack());
    await settle();
    expect(media.onlyPlaying().getAttribute('src')).toBe(trackUrl('t3'));
  });

  test('"Add to Queue" adds the track after the ones already queued', async () => {
    await openLibrary();
    await tapTrack(NEWS);

    openMenuFor(SPORTS);
    chooseMenuItem(/Add to Queue/);
    openMenuFor(WEATHER);
    chooseMenuItem(/Add to Queue/);
    openMenuFor(POEM);
    chooseMenuItem(/Play Next/);

    expect(snackbar).toHaveBeenCalledWith('Added to queue', 'success');
    expect(player().userQueue).toEqual(['s1', 't3', 't2']);
  });

  test('"Copy Transcript" copies the whole transcript', async () => {
    await openLibrary();
    openMenuFor(NEWS);
    chooseMenuItem(/Copy Transcript/);
    await settle();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Dzień dobry Oto wiadomości');
    expect(snackbar).toHaveBeenLastCalledWith('Transcript copied to clipboard', 'success');
  });

  test('"Copy Transcript" on a track without one says there is nothing to copy', async () => {
    await openLibrary();
    openMenuFor(WEATHER);
    chooseMenuItem(/Copy Transcript/);
    await settle();

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(snackbar).toHaveBeenLastCalledWith('No transcript available', 'warning');
  });

  test('a failed copy is reported', async () => {
    await openLibrary();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    openMenuFor(NEWS);
    chooseMenuItem(/Copy Transcript/);
    await settle();

    expect(snackbar).toHaveBeenLastCalledWith('Failed to copy transcript', 'error');
  });

  test('listeners can rename and delete their own tracks but not system ones', async () => {
    await openLibrary();
    openMenuFor(NEWS);
    expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    act(() => vi.advanceTimersByTime(500));

    openMenuFor(POEM);
    expect(screen.queryByRole('menuitem', { name: /Rename/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
  });

  test('renaming a track saves the trimmed title and the list shows it', async () => {
    await openLibrary();
    openMenuFor(WEATHER);
    chooseMenuItem(/Rename/);

    const dialog = screen.getByRole('dialog', { name: 'Rename Audio' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue(WEATHER);
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: '  Tomorrow’s weather  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await settle();

    expect(remote.get(`users/${UID}/audioItems/t2`)?.title).toBe('Tomorrow’s weather');
    expect(rowTitles()).toContain('Tomorrow’s weather');
  });

  test('a blank title cannot be saved', async () => {
    await openLibrary();
    openMenuFor(WEATHER);
    chooseMenuItem(/Rename/);
    const dialog = screen.getByRole('dialog', { name: 'Rename Audio' });

    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: '   ' } });

    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('admins rename system tracks in the shared collection', async () => {
    await openLibrary(undefined, { isAdmin: true });
    openMenuFor(POEM);
    chooseMenuItem(/Rename/);
    const dialog = screen.getByRole('dialog', { name: 'Rename Audio' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Poem' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await settle();

    expect(remote.get('systemAudioItems/s1')?.title).toBe('Poem');
  });

  test('deleting a track asks first, then deletes it on the server', async () => {
    await openLibrary();
    openMenuFor(SPORTS);
    chooseMenuItem(/Delete/);

    const dialog = screen.getByRole('dialog', { name: 'Delete Audio' });
    expect(dialog).toHaveTextContent(
      'Are you sure you want to delete "Sports"? This will remove the audio file and its transcript.'
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await settle();

    expect(callables.calls).toHaveBeenCalledWith('deleteUserAudio', { audioId: 't3' });
  });

  test('cancelling the delete leaves the track alone', async () => {
    await openLibrary();
    openMenuFor(SPORTS);
    chooseMenuItem(/Delete/);
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete Audio' })).getByRole('button', {
        name: 'Cancel',
      })
    );
    await settle();

    expect(callables.calls).not.toHaveBeenCalled();
  });

  test('deleting a system track warns that it goes for everyone', async () => {
    await openLibrary(undefined, { isAdmin: true });
    openMenuFor(POEM);
    chooseMenuItem(/Delete/);

    const dialog = screen.getByRole('dialog', { name: 'Delete Audio' });
    expect(dialog).toHaveTextContent('This will remove the audio for all users.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await settle();

    expect(callables.calls).toHaveBeenCalledWith('deleteSystemAudio', { id: 's1' });
  });
});

describe('creating audio from text', () => {
  function openCreate(name: RegExp) {
    fireEvent.click(screen.getByTestId('AddIcon').closest('button')!);
    chooseMenuItem(name);
  }

  test('generates audio from the trimmed title and text', async () => {
    await openLibrary();
    openCreate(/Generate from Text/);
    const dialog = screen.getByRole('dialog', { name: 'Generate Audio from Text' });

    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: ' Story ' } });
    fireEvent.change(within(dialog).getByLabelText('Polish text'), {
      target: { value: ' Był sobie kot. ' },
    });
    expect(within(dialog).getByText('16/2000')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await settle();

    expect(callables.calls).toHaveBeenCalledWith('createUserAudio', {
      title: 'Story',
      text: 'Był sobie kot.',
    });
    expect(snackbar).toHaveBeenLastCalledWith('Audio queued for processing', 'success');
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('text longer than 2000 characters is not accepted', async () => {
    await openLibrary();
    openCreate(/Generate from Text/);
    const text = within(screen.getByRole('dialog')).getByLabelText('Polish text');

    fireEvent.change(text, { target: { value: 'a'.repeat(2000) } });
    fireEvent.change(text, { target: { value: 'a'.repeat(2001) } });

    expect(text).toHaveValue('a'.repeat(2000));
  });

  test('a failure keeps the dialog open and shows the reason', async () => {
    await openLibrary();
    callables.handle = async () => {
      throw new Error('Daily generation limit reached');
    };
    openCreate(/Generate from Text/);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Story' } });
    fireEvent.change(within(dialog).getByLabelText('Polish text'), { target: { value: 'Kot' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await settle();

    expect(snackbar).toHaveBeenLastCalledWith('Daily generation limit reached', 'error');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  test('the Create System Audio option is only offered to admins', async () => {
    await openLibrary();
    fireEvent.click(screen.getByTestId('AddIcon').closest('button')!);
    expect(screen.queryByRole('menuitem', { name: /Create System Audio/ })).toBeNull();
  });

  test('admins create system audio through its own function', async () => {
    await openLibrary(undefined, { isAdmin: true });
    openCreate(/Create System Audio/);
    const dialog = screen.getByRole('dialog', { name: 'Create System Audio' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Lesson' } });
    fireEvent.change(within(dialog).getByLabelText('Polish text'), {
      target: { value: 'b'.repeat(2500) },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await settle();

    expect(callables.calls).toHaveBeenCalledWith('createSystemAudio', {
      title: 'Lesson',
      text: 'b'.repeat(2500),
    });
    expect(snackbar).toHaveBeenLastCalledWith('System audio queued for processing', 'success');
  });
});

describe('queue drawer', () => {
  test('shows the playing track and what comes next', async () => {
    await openLibrary();
    await tapTrack(POEM);
    const drawer = openQueue();

    expect(within(drawer).getByText('Now Playing')).toBeInTheDocument();
    expect(within(drawer).getByText(POEM)).toBeInTheDocument();
    expect(within(drawer).getByText('Next Up · 2')).toBeInTheDocument();
    const titles = within(drawer)
      .getAllByTestId('DragHandleIcon')
      .map((icon) => icon.closest('button')!.nextElementSibling!.querySelector('p')!.textContent);
    expect(titles).toEqual([WEATHER, SPORTS]);
    expect(within(drawer).getByText('2:05')).toBeInTheDocument();
  });

  test('queued tracks are listed apart from the rest of the library', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    openMenuFor(SPORTS);
    chooseMenuItem(/Add to Queue/);

    const drawer = openQueue();
    expect(within(drawer).getByText('Next in Queue · 1')).toBeInTheDocument();
    expect(within(drawer).getByText('Next Up · 3')).toBeInTheDocument();
  });

  test('removing a track takes it out of the queue', async () => {
    await openLibrary();
    await tapTrack(POEM);
    const drawer = openQueue();

    const weatherRow = within(drawer).getByText(WEATHER).parentElement!.parentElement!;
    fireEvent.click(within(weatherRow).getByTestId('RemoveCircleOutlineIcon').closest('button')!);

    expect(within(drawer).queryByText(WEATHER)).not.toBeInTheDocument();
    expect(within(drawer).getByText('Next Up · 1')).toBeInTheDocument();
    expect(player().autoQueue).toEqual(['t3']);
    await settle();
    expect(remote.get(queuePath)?.autoQueue).toEqual(['t3']);
  });

  test('its play button pauses and resumes the playing track', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const el = media.withSource(trackUrl('t1'));
    const drawer = openQueue();
    const nowPlaying = within(drawer).getByText('Now Playing').nextElementSibling as HTMLElement;

    const button = within(nowPlaying).getByRole('button');

    expect(within(button).getByTestId('PauseIcon')).toBeInTheDocument();
    fireEvent.click(button);
    expect(el.paused).toBe(true);
    expect(within(button).getByTestId('PlayArrowIcon')).toBeInTheDocument();
    fireEvent.click(button);
    expect(el.paused).toBe(false);
  });

  test('on the last track it says nothing is coming up', async () => {
    await openLibrary();
    await tapTrack(SPORTS);
    const drawer = openQueue();
    expect(within(drawer).getByText('No upcoming tracks')).toBeInTheDocument();
  });

  test('the close button closes it', async () => {
    await openLibrary();
    await tapTrack(SPORTS);
    const drawer = openQueue();
    fireEvent.click(within(drawer).getByTestId('CloseIcon').closest('button')!);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Now Playing')).not.toBeInTheDocument();
  });

  test('tapping a queued track plays it', async () => {
    await openLibrary();
    await tapTrack(NEWS);
    const drawer = openQueue();

    fireEvent.click(within(drawer).getByText(SPORTS));
    await settle();

    expect(media.onlyPlaying().getAttribute('src')).toBe(trackUrl('t3'));
  });
});

describe('uploading audio', () => {
  const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

  function chooseFile(file: File) {
    fireEvent.click(screen.getByTestId('AddIcon').closest('button')!);
    chooseMenuItem(/Upload Audio/);
    fireEvent.change(fileInput(), { target: { files: [file] } });
  }

  test('a failed upload clears the progress overlay', async () => {
    await openLibrary();
    chooseFile(new File(['abc'], 'lecture.mp3', { type: 'audio/mpeg' }));
    await settle();
    act(() => storageServer.uploads[0].progress(10, 100));
    expect(screen.getByText('Uploading...')).toBeInTheDocument();

    act(() => storageServer.uploads[0].fail('Network lost'));
    await settle();

    expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
  });

  test('only audio files can be picked', async () => {
    await openLibrary();
    expect(fileInput()).toHaveAttribute('accept', '.mp3,.wav,.ogg,.flac,.m4a,audio/*');
  });

  test('shows upload progress, then transcription, and the track joins the library', async () => {
    await openLibrary();
    chooseFile(new File(['abc'], 'lecture.mp3', { type: 'audio/mpeg' }));
    await settle();

    const upload = storageServer.uploads[0];
    expect(upload.path).toMatch(new RegExp(`^audio/users/${UID}/pending/[^/]+/lecture\\.mp3$`));
    act(() => upload.progress(40, 100));
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').at(-1)).toHaveAttribute('aria-valuenow', '40');

    act(() => upload.complete());
    expect(screen.getByText('Transcribing audio...')).toBeInTheDocument();

    const audioId = upload.path.split('/')[4];
    seedTracks(track(audioId, { title: 'Lecture', createdAt: Date.UTC(2026, 2, 10) }));
    await settle();

    expect(screen.queryByText('Transcribing audio...')).not.toBeInTheDocument();
    expect(rowTitles()[0]).toBe('Lecture');
  });

  test('a file that cannot be uploaded tells the listener why', async () => {
    await openLibrary();
    chooseFile(new File(['voice'], 'memo.webm', { type: 'audio/webm' }));
    await settle();

    expect(storageServer.uploads).toHaveLength(0);
    const shown =
      screen.queryByText(/Unsupported format/) ??
      snackbar.mock.calls.find(([message]) => /Unsupported format/.test(message));
    expect(shown).toBeTruthy();
  });
});

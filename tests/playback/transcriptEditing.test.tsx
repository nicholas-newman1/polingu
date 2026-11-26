/**
 * Correcting a system track's transcript from the player page (admins only), through
 * EditTranscriptSegmentDialog. The test user is never an admin in the real app; here
 * the auth context is a stand-in, and every write goes to the fake Firestore.
 */
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { media } from './support/media';
import { setupBrowser } from './support/browser';
import {
  goTo,
  renderApp,
  saveErrors,
  seedLibrary,
  settle,
  setupApp,
  systemTrack,
  systemTrackUrl,
  track,
  freezeClock,
  waitUntil,
} from './support/app';
import { line } from './support/transcript';
import { remote } from '../sync/support/fakeFirestore';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));

media.setup();
setupBrowser();
setupApp();

const LESSON = 'Lesson one';
const LESSON_LINES = [
  line('Dzień dobry', 0, 2),
  line('Oto najnowsze wiadomości', 3, 6),
  line('Do widzenia', 7, 8),
];
const LIBRARY = {
  systemTracks: [
    systemTrack('s1', { title: LESSON, createdAt: 3000, transcript: LESSON_LINES }),
    systemTrack('s2', { title: 'Lesson two', createdAt: 2000, transcript: [line('Cześć', 0, 1)] }),
  ],
  tracks: [track('t1', { title: 'My upload', createdAt: 1000, transcript: LESSON_LINES })],
};

async function openPlayerWith(title: string, isAdmin: boolean) {
  freezeClock();
  await seedLibrary(LIBRARY);
  renderApp({ isAdmin });
  await waitUntil(() => screen.getByText(title));
  fireEvent.click(screen.getByText(title));
  await settle();
  goTo('/audio/player');
  await settle();
}

const editButton = () => screen.queryByRole('button', { name: 'Edit transcript' });
const editableLines = () => screen.getAllByRole('button', { name: 'Edit this line' });

function enterEditMode() {
  fireEvent.click(editButton()!);
}

function editLine(index: number) {
  fireEvent.click(editableLines()[index]);
  return screen.getByRole('dialog', { name: 'Edit Transcript Line' });
}

function closeTransitions() {
  act(() => vi.advanceTimersByTime(1000));
}

describe('who can edit', () => {
  test('listeners who are not admins get no edit button', async () => {
    await openPlayerWith(LESSON, false);
    expect(screen.getAllByRole('button', { name: 'Jump to this line' })).toHaveLength(3);
    expect(editButton()).not.toBeInTheDocument();
  });

  test("admins cannot edit a listener's own upload", async () => {
    await openPlayerWith('My upload', true);
    expect(editButton()).not.toBeInTheDocument();
  });

  test('admins can edit system tracks', async () => {
    await openPlayerWith(LESSON, true);
    expect(editButton()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('edit mode', () => {
  test('entering edit mode pauses playback and turns every line into an edit button', async () => {
    await openPlayerWith(LESSON, true);
    const el = media.withSource(systemTrackUrl('s1'));

    enterEditMode();

    expect(el.paused).toBe(true);
    expect(screen.getByText('Editing transcript — tap a line to correct it')).toBeInTheDocument();
    expect(editableLines().map((l) => l.textContent)).toEqual(LESSON_LINES.map((l) => l.text));
    expect(screen.queryByRole('button', { name: 'Jump to this line' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit transcript edit mode' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('leaving edit mode brings back the jump buttons', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    fireEvent.click(screen.getByRole('button', { name: 'Exit transcript edit mode' }));

    expect(screen.getAllByRole('button', { name: 'Jump to this line' })).toHaveLength(3);
    expect(screen.queryByText(/Editing transcript/)).not.toBeInTheDocument();
  });

  test('moving to another track leaves edit mode', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();

    fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
    await settle();

    expect(media.onlyPlaying().getAttribute('src')).toBe(systemTrackUrl('s2'));
    expect(screen.queryByText(/Editing transcript/)).not.toBeInTheDocument();
    expect(editButton()).toHaveAttribute('aria-pressed', 'false');
  });

  test('a line can be opened for editing from the keyboard', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();

    fireEvent.keyDown(editableLines()[2], { key: 'Enter' });

    const dialog = screen.getByRole('dialog', { name: 'Edit Transcript Line' });
    expect(within(dialog).getByLabelText('Line text')).toHaveValue('Do widzenia');
  });
});

describe('editing a line', () => {
  test('saving replaces the line and spreads its word timings evenly across it', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    const dialog = editLine(1);
    expect(within(dialog).getByLabelText('Line text')).toHaveValue('Oto najnowsze wiadomości');

    fireEvent.change(within(dialog).getByLabelText('Line text'), {
      target: { value: '  Oto nowe wiadomości dnia ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await settle();

    const saved = remote.get('systemAudioItems/s1')!.transcript as typeof LESSON_LINES;
    expect(saved[0]).toEqual(LESSON_LINES[0]);
    expect(saved[2]).toEqual(LESSON_LINES[2]);
    expect(saved[1]).toEqual({
      text: 'Oto nowe wiadomości dnia',
      startTime: 3,
      endTime: 6,
      words: [
        { word: 'Oto', startTime: 3, endTime: 3.75, confidence: 1 },
        { word: 'nowe', startTime: 3.75, endTime: 4.5, confidence: 1 },
        { word: 'wiadomości', startTime: 4.5, endTime: 5.25, confidence: 1 },
        { word: 'dnia', startTime: 5.25, endTime: 6, confidence: 1 },
      ],
    });

    closeTransitions();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(editableLines()[1]).toHaveTextContent('Oto nowe wiadomości dnia');
  });

  test('saving an unchanged line just closes the editor', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    const dialog = editLine(0);

    fireEvent.change(within(dialog).getByLabelText('Line text'), {
      target: { value: 'Dzień dobry  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await settle();
    closeTransitions();

    expect(remote.callsTo('updateDoc')).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('a blank line cannot be saved', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    const dialog = editLine(0);

    fireEvent.change(within(dialog).getByLabelText('Line text'), { target: { value: '   ' } });

    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('cancel closes the editor without saving', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    const dialog = editLine(0);
    fireEvent.change(within(dialog).getByLabelText('Line text'), { target: { value: 'Hej' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await settle();
    closeTransitions();

    expect(remote.callsTo('updateDoc')).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(editableLines()[0]).toHaveTextContent('Dzień dobry');
  });

  test('a failed save is reported and the editor stays open with the draft', async () => {
    await openPlayerWith(LESSON, true);
    remote.fail({ op: 'updateDoc', path: 'systemAudioItems/s1' });
    enterEditMode();
    const dialog = editLine(2);

    fireEvent.change(within(dialog).getByLabelText('Line text'), { target: { value: 'Pa pa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await settle();

    expect(saveErrors).toHaveBeenCalledWith('Failed to save. Please try again.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Line text')).toHaveValue('Pa pa');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('typing a space in the editor does not toggle playback', async () => {
    await openPlayerWith(LESSON, true);
    enterEditMode();
    const el = media.withSource(systemTrackUrl('s1'));
    const dialog = editLine(0);

    fireEvent.keyDown(within(dialog).getByLabelText('Line text'), { key: ' ', code: 'Space' });

    expect(el.paused).toBe(true);
  });
});

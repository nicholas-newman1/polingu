/**
 * Listening mode: the hub builds a queue from review data, ListeningProvider plays it
 * with per-group repetitions and gaps, and the player page and mini bar control it.
 * Listening is passive: it must never change review (SRS) progress.
 */
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { media } from './support/media';
import { setupBrowser } from './support/browser';
import {
  goTo,
  listening,
  renderApp,
  saveErrors,
  seedLibrary,
  settle,
  setupApp,
  track,
  trackUrl,
  UID,
  freezeClock,
  waitUntil,
} from './support/app';
import { srsWrites, type ReviewFixture } from './support/probes';
import { fsrsCard, inDays } from '../helpers/fsrs';
import { remote } from '../sync/support/fakeFirestore';
import { userDb } from '../../src/lib/offlineDb/userDb';
import { DEFAULT_LISTENING_SETTINGS, type ListeningSettings } from '../../src/types/listening';
import type { Sentence, SentenceReviewDataStore } from '../../src/types/sentences';
import type { VocabularyWord } from '../../src/types/vocabulary';
import type { DeclensionCard } from '../../src/types';
import type { Card } from 'ts-fsrs';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/storage', () => import('./support/firebaseStorage'));
vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));

media.setup();
setupBrowser();
setupApp();

const clip = (id: string) => `https://audio.test/${id}.mp3`;
const settingsPath = `users/${UID}/data/listeningSettings`;
const selectionsPath = `users/${UID}/data/listeningHubSelections`;

const sentence = (id: string, polish: string, english: string, level: Sentence['level']) =>
  ({ id, polish, english, level, tags: [], audioUrl: clip(id) }) as Sentence;

const sentenceStore = (cards: Record<string, Card>): SentenceReviewDataStore => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([sentenceId, card]) => [sentenceId, { sentenceId, fsrsCard: card }])
  ),
  reviewedToday: [],
  newCardsToday: [],
  lastReviewDate: '2026-03-10',
});

/**
 * Four sentences with audio and one without. Built after the clock is frozen, since
 * "due" is relative to now.
 *   x1  new                     unfamiliar
 *   x2  review, due yesterday   learned
 *   x3  learning, due 3 days ago unfamiliar
 *   x4  review, due in 5 days   learned
 */
function sentencesFixture(): ReviewFixture {
  return {
    sentences: [
      sentence('x1', 'Lubię kawę.', 'I like coffee.', 'A1'),
      sentence('x2', 'Mam kota.', 'I have a cat.', 'A2'),
      sentence('x3', 'Idę do domu.', 'I am going home.', 'B1'),
      sentence('x4', 'Pada deszcz.', 'It is raining.', 'B2'),
      { ...sentence('x5', 'Bez nagrania.', 'No recording.', 'A1'), audioUrl: undefined },
    ],
    sentenceStores: {
      'pl-to-en': sentenceStore({
        x2: fsrsCard(State.Review, inDays(-1)),
        x3: fsrsCard(State.Learning, inDays(-3)),
        x4: fsrsCard(State.Review, inDays(5)),
      }),
    },
  };
}

function seedSettings(settings: Partial<ListeningSettings>) {
  remote.seed(settingsPath, { ...DEFAULT_LISTENING_SETTINGS, ...settings });
}

const startButton = () => screen.getByRole('button', { name: 'Start listening' });

async function openHub(
  settings: Partial<ListeningSettings> = {},
  fixture?: () => ReviewFixture,
  options: { strict?: boolean } = {}
) {
  freezeClock();
  seedSettings(settings);
  renderApp({ route: '/listen', review: (fixture ?? sentencesFixture)(), ...options });
  await waitUntil(() => screen.getByText(/^[1-9]\d* cards? ready$|No cards with audio/));
  await settle();
}

async function startListening() {
  fireEvent.click(startButton());
  await settle();
}

/** In "recently added" order the queue is x4, x3, x2, x1: learned, unfamiliar, learned, unfamiliar. */
async function startRecentlyAdded(options: { strict?: boolean } = {}) {
  await openHub({ ordering: 'recently-added' }, undefined, options);
  await startListening();
}

const cardText = () => screen.getByRole('heading', { level: 4 }).textContent;
const cardChip = () =>
  screen.getByRole('heading', { level: 4 }).parentElement!.firstElementChild!.textContent;
const nowPlaying = () => media.onlyPlaying().getAttribute('src');
const listeningElement = () =>
  document.querySelector('audio[style*="display: none"]') as HTMLAudioElement;
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const endClip = () => media.finish(listeningElement());

function selectOption(combobox: HTMLElement, option: string) {
  fireEvent.mouseDown(combobox);
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
  wait(500);
}

function chooseSetting(group: 'Learned cards' | 'Unknown cards', setting: string, option: string) {
  const groupBox = screen.getByText(group).parentElement!;
  const row = within(groupBox).getByText(setting).parentElement!;
  selectOption(within(row).getByRole('combobox'), option);
}

describe('the listening hub', () => {
  test('counts the cards that have audio', async () => {
    await openHub();
    expect(screen.getByText('4 cards ready')).toBeInTheDocument();
    expect(startButton()).toBeEnabled();
  });

  test('turning levels off leaves their cards out', async () => {
    await openHub();
    fireEvent.click(screen.getByRole('button', { name: 'A1' }));
    fireEvent.click(screen.getByRole('button', { name: 'B2' }));
    expect(screen.getByText('2 cards ready')).toBeInTheDocument();
    await settle();
    expect(remote.get(selectionsPath)?.selectedLevels).toEqual(['A2', 'B1', 'C1', 'C2']);
  });

  test('"Due first" keeps only due cards and plays the most overdue first', async () => {
    await openHub();
    selectOption(
      within(screen.getByText('Ordering').parentElement!).getByRole('combobox'),
      'Due first'
    );

    expect(screen.getByText('2 cards ready')).toBeInTheDocument();
    await startListening();

    expect(screen.getByTestId('location')).toHaveTextContent('/listen/play');
    expect(screen.getByText('Sentences · Due first')).toBeInTheDocument();
    expect(cardText()).toBe('Idę do domu.');
    expect(screen.getByText('I am going home.')).toBeInTheDocument();
    expect(nowPlaying()).toBe(clip('x3'));
  });

  test('the chosen ordering is saved for next time', async () => {
    await openHub();
    selectOption(
      within(screen.getByText('Ordering').parentElement!).getByRole('combobox'),
      'Practice ahead'
    );
    await settle();

    expect(remote.get(settingsPath)?.ordering).toBe('practice-ahead');
    expect(screen.getByText('1 card ready')).toBeInTheDocument();
  });

  test('"Recently added" plays the newest cards first', async () => {
    await startRecentlyAdded();
    expect(listening().queue.map((item) => item.id)).toEqual([
      'sentence:x4',
      'sentence:x3',
      'sentence:x2',
      'sentence:x1',
    ]);
  });

  test('"Learned cards only" queues just the learned cards', async () => {
    await openHub({ ordering: 'learned' });
    expect(screen.getByText('2 cards ready')).toBeInTheDocument();
    await startListening();

    expect(
      listening()
        .queue.map((item) => item.id)
        .sort()
    ).toEqual(['sentence:x2', 'sentence:x4']);
    expect(listening().queue.every((item) => item.isLearned)).toBe(true);
  });

  test('which cards count as learned follows the chosen review direction', async () => {
    await openHub({ ordering: 'learned' }, () => ({
      ...sentencesFixture(),
      sentenceStores: {
        'pl-to-en': sentenceStore({ x2: fsrsCard(State.Review, inDays(-1)) }),
        'en-to-pl': sentenceStore({
          x1: fsrsCard(State.Review, inDays(2)),
          x3: fsrsCard(State.Review, inDays(2)),
          x4: fsrsCard(State.Review, inDays(2)),
        }),
      },
    }));
    expect(screen.getByText('1 card ready')).toBeInTheDocument();

    selectOption(screen.getByRole('combobox', { name: 'Review store' }), 'Production (EN → PL)');
    expect(screen.getByText('3 cards ready')).toBeInTheDocument();
  });

  test('vocabulary queues words with audio', async () => {
    await openHub({ ordering: 'recently-added' }, () => ({
      vocabularyWords: [
        { id: 'w1', polish: 'kot', english: 'cat', audioUrl: clip('w1') } as VocabularyWord,
        { id: 'w2', polish: 'pies', english: 'dog' } as VocabularyWord,
      ],
    }));
    selectOption(screen.getByRole('combobox', { name: 'Feature' }), 'Vocabulary');
    expect(screen.queryByText('Levels')).not.toBeInTheDocument();
    expect(screen.getByText('1 card ready')).toBeInTheDocument();
    await settle();
    expect(remote.get(selectionsPath)?.feature).toBe('vocabulary');

    await startListening();
    expect(cardText()).toBe('kot');
    expect(cardChip()).toBe('Word · 1/1 · rep 1/2');
  });

  test('declension plays the declined form and shows the phrase it comes from', async () => {
    const card = {
      id: 'd1',
      front: 'kot',
      back: 'Widzę kota.',
      declined: 'kota',
      case: 'Accusative',
      gender: 'Masculine',
      number: 'Singular',
      audioUrl: clip('d1'),
    } as DeclensionCard;
    await openHub({}, () => ({ declensionCards: [card] }));
    selectOption(screen.getByRole('combobox', { name: 'Feature' }), 'Declension');
    expect(screen.queryByRole('combobox', { name: 'Review store' })).not.toBeInTheDocument();

    await startListening();
    expect(cardText()).toBe('kota');
    expect(screen.getByText('kot → Widzę kota.')).toBeInTheDocument();
    expect(cardChip()).toMatch(/^Declension · 1\/1/);
  });

  test('with nothing to play it says so and cannot start', async () => {
    await openHub({}, () => ({}));
    selectOption(screen.getByRole('combobox', { name: 'Feature' }), 'Declension');

    expect(
      screen.getByText('No cards with audio match the current selection.')
    ).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  test('remembers the source choices on the next visit', async () => {
    freezeClock();
    remote.seed(selectionsPath, {
      feature: 'sentences',
      direction: 'en-to-pl',
      selectedLevels: ['B1'],
    });
    renderApp({ route: '/listen', review: sentencesFixture() });
    await waitUntil(() => screen.getByText(/^[1-9]\d* cards? ready$/));
    await settle();

    expect(screen.getByRole('combobox', { name: 'Review store' })).toHaveTextContent(
      'Production (EN → PL)'
    );
    expect(screen.getByText('1 card ready')).toBeInTheDocument();
  });
});

describe('playing the queue', () => {
  test('learned cards play once and unfamiliar cards twice, with the configured gaps', async () => {
    await startRecentlyAdded();

    // x4, learned: one play, then 1 s to the next card.
    expect(cardText()).toBe('Pada deszcz.');
    expect(cardChip()).toBe('Sentence · 1/4 · learned');
    expect(nowPlaying()).toBe(clip('x4'));
    endClip();
    wait(999);
    expect(media.playing()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    wait(1);
    expect(nowPlaying()).toBe(clip('x3'));

    // x3, unfamiliar: two plays 1 s apart, then 2 s to the next card.
    expect(cardChip()).toBe('Sentence · 2/4 · rep 1/2');
    endClip();
    wait(1000);
    expect(nowPlaying()).toBe(clip('x3'));
    expect(listeningElement().currentTime).toBe(0);
    expect(cardChip()).toBe('Sentence · 2/4 · rep 2/2');
    endClip();
    wait(1999);
    expect(media.playing()).toEqual([]);
    wait(1);
    expect(nowPlaying()).toBe(clip('x2'));
    expect(cardChip()).toBe('Sentence · 3/4 · learned');
  });

  test('after the last card the session ends and returns to the hub', async () => {
    await startRecentlyAdded();
    act(() => listening().next());
    act(() => listening().next());
    act(() => listening().next());
    expect(cardText()).toBe('Lubię kawę.');

    endClip();
    wait(1000);
    endClip();
    await settle();

    expect(listening().isActive).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/listen');
    expect(media.playing()).toEqual([]);
  });

  test('the groups follow the settings chosen for them', async () => {
    await openHub({
      ordering: 'recently-added',
      learned: { repetitions: 3, gapBetweenRepetitions: 4, gapBetweenCards: 8 },
    });
    await startListening();
    expect(cardChip()).toBe('Sentence · 1/4 · rep 1/3 · learned');

    endClip();
    wait(3999);
    expect(media.playing()).toEqual([]);
    wait(1);
    expect(cardChip()).toBe('Sentence · 1/4 · rep 2/3 · learned');
    endClip();
    wait(4000);
    endClip();
    wait(7999);
    expect(cardText()).toBe('Pada deszcz.');
    wait(1);
    expect(cardText()).toBe('Idę do domu.');
  });

  test('changing repetitions mid-session applies to the cards still to come', async () => {
    await startRecentlyAdded();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle settings' }));
    chooseSetting('Unknown cards', 'Repetitions per card', '1');
    chooseSetting('Unknown cards', 'Gap between cards', '0.5s');
    await settle();

    endClip();
    wait(1000);
    expect(cardChip()).toBe('Sentence · 2/4');
    endClip();
    wait(500);
    expect(cardText()).toBe('Mam kota.');
    expect(remote.get(settingsPath)?.unknown).toEqual({
      repetitions: 1,
      gapBetweenCards: 0.5,
      gapBetweenRepetitions: 1,
    });
  });

  test('next and previous jump between cards and play them from the start', async () => {
    await startRecentlyAdded();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(cardText()).toBe('Idę do domu.');
    expect(nowPlaying()).toBe(clip('x3'));

    media.moveTo(listeningElement(), 1.2);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(cardText()).toBe('Pada deszcz.');
    expect(nowPlaying()).toBe(clip('x4'));
    expect(listeningElement().currentTime).toBe(0);
  });

  test('next is disabled on the last card', async () => {
    await startRecentlyAdded();
    act(() => listening().next());
    act(() => listening().next());
    act(() => listening().next());
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('skipping during a gap cancels the pending repeat', async () => {
    await startRecentlyAdded();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    endClip();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(cardText()).toBe('Mam kota.');
    const plays = media.playCalls.length;
    wait(5000);
    expect(media.playCalls.length).toBe(plays);
    expect(listening().currentRepetition).toBe(1);
    expect(cardChip()).toBe('Sentence · 3/4 · learned');
  });

  test('pause stops the clip; play starts the card again', async () => {
    await startRecentlyAdded();
    const el = listeningElement();
    media.moveTo(el, 1.5);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(el.paused).toBe(true);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(el.paused).toBe(false);
    expect(el.currentTime).toBe(0);
    expect(cardText()).toBe('Pada deszcz.');
  });

  test('pausing in the gap between clips stops the session moving on', async () => {
    await startRecentlyAdded();
    endClip();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    wait(10_000);

    expect(media.playing()).toEqual([]);
    expect(cardText()).toBe('Pada deszcz.');
  });

  test('pausing in the gap between clips shows Play, and Play resumes', async () => {
    await startRecentlyAdded();
    endClip();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(media.playing()).toHaveLength(1);
  });

  test('the playback rate applies to the playing clip at once and is saved', async () => {
    await startRecentlyAdded();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle settings' }));

    const rateRow = screen.getByText('Playback rate').parentElement!;
    fireEvent.change(within(rateRow).getByRole('slider'), { target: { value: '1.5' } });
    // The value is shown next to the slider.
    expect(rateRow.lastElementChild!.lastElementChild).toHaveTextContent('1.5x');
    expect(listeningElement().playbackRate).toBe(1.5);

    endClip();
    wait(1000);
    expect(listeningElement().playbackRate).toBe(1.5);
    await settle();
    expect(remote.get(settingsPath)?.playbackRate).toBe(1.5);
  });

  test('a settings save that fails is reported', async () => {
    await startRecentlyAdded();
    remote.fail({ op: 'setDoc', path: settingsPath });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle settings' }));

    chooseSetting('Learned cards', 'Gap between cards', '4s');
    await settle();

    expect(saveErrors).toHaveBeenCalledWith('Failed to save. Please try again.');
    expect(listening().settings.learned.gapBetweenCards).toBe(4);
  });

  test('settings saved earlier are used from the start', async () => {
    await openHub({ ordering: 'due', playbackRate: 0.7 });
    expect(
      within(screen.getByText('Ordering').parentElement!).getByRole('combobox')
    ).toHaveTextContent('Due first');
    await startListening();
    expect(listeningElement().playbackRate).toBe(0.7);
  });

  test('the player page with no session goes back to the hub', async () => {
    freezeClock();
    renderApp({ route: '/listen/play', review: sentencesFixture() });
    await settle();
    expect(screen.getByTestId('location')).toHaveTextContent('/listen');
    expect(screen.getByRole('button', { name: 'Start listening' })).toBeInTheDocument();
  });

  test('works the same under StrictMode', async () => {
    await startRecentlyAdded({ strict: true });
    expect(nowPlaying()).toBe(clip('x4'));
    endClip();
    wait(1000);
    expect(nowPlaying()).toBe(clip('x3'));
    endClip();
    wait(1000);
    expect(cardChip()).toBe('Sentence · 2/4 · rep 2/2');
  });
});

describe('the listening mini bar', () => {
  const miniBar = () => screen.queryByRole('button', { name: 'Open listening player' });

  test('follows you around the app, but not onto the player page', async () => {
    await startRecentlyAdded();
    expect(miniBar()).not.toBeInTheDocument();

    goTo('/dashboard');
    expect(miniBar()).toHaveTextContent('Pada deszcz.');
    expect(miniBar()).toHaveTextContent('Sentences · 1/4');

    goTo('/audio');
    expect(miniBar()).toBeInTheDocument();
  });

  test('shows the repetition count for cards played more than once', async () => {
    await startRecentlyAdded();
    act(() => listening().next());
    goTo('/dashboard');
    expect(miniBar()).toHaveTextContent('Sentences · 2/4 · rep 1/2');
  });

  test('its buttons pause, resume and skip without opening the player', async () => {
    await startRecentlyAdded();
    goTo('/dashboard');
    const bar = miniBar()!;

    fireEvent.click(within(bar).getByRole('button', { name: 'Pause' }));
    expect(listeningElement().paused).toBe(true);
    fireEvent.click(within(bar).getByRole('button', { name: 'Play' }));
    expect(listeningElement().paused).toBe(false);

    fireEvent.click(within(bar).getByRole('button', { name: 'Next' }));
    expect(bar).toHaveTextContent('Idę do domu.');
    fireEvent.click(within(bar).getByRole('button', { name: 'Previous' }));
    expect(bar).toHaveTextContent('Pada deszcz.');
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });

  test('tapping it opens the player', async () => {
    await startRecentlyAdded();
    goTo('/dashboard');
    fireEvent.click(miniBar()!);
    expect(screen.getByTestId('location')).toHaveTextContent('/listen/play');
  });

  test('stop ends the session and silences it', async () => {
    await startRecentlyAdded();
    goTo('/dashboard');
    const el = listeningElement();

    fireEvent.click(within(miniBar()!).getByRole('button', { name: 'Stop listening' }));

    expect(miniBar()).not.toBeInTheDocument();
    expect(el.paused).toBe(true);
    expect(el.hasAttribute('src')).toBe(false);
    wait(5000);
    expect(media.playing()).toEqual([]);
  });

  test('next on the last card ends the session', async () => {
    await startRecentlyAdded();
    act(() => listening().next());
    act(() => listening().next());
    act(() => listening().next());
    goTo('/dashboard');

    fireEvent.click(within(miniBar()!).getByRole('button', { name: 'Next' }));

    expect(miniBar()).not.toBeInTheDocument();
    expect(media.playing()).toEqual([]);
  });
});

describe('listening and the audio player take turns', () => {
  const NEWS = track('t1', { title: 'Morning news' });

  test('starting a listening session pauses the audio player', async () => {
    freezeClock();
    await seedLibrary({ tracks: [NEWS] });
    seedSettings({ ordering: 'recently-added' });
    renderApp({ route: '/audio', review: sentencesFixture() });
    await waitUntil(() => screen.getByText('Morning news'));
    fireEvent.click(screen.getByText('Morning news'));
    await settle();
    const audio = media.withSource(trackUrl('t1'));

    goTo('/listen');
    await waitUntil(() => expect(startButton()).toBeEnabled());
    await startListening();

    expect(audio.paused).toBe(true);
    expect(nowPlaying()).toBe(clip('x4'));
  });

  test('starting the audio player pauses listening, including a pending repeat', async () => {
    freezeClock();
    await seedLibrary({ tracks: [NEWS] });
    await openHub({ ordering: 'recently-added' });
    await startListening();
    // x3 is unfamiliar, so ending its first play schedules a repeat in 1 s.
    act(() => listening().next());
    endClip();

    goTo('/audio');
    await waitUntil(() => screen.getByText('Morning news'));
    fireEvent.click(screen.getByText('Morning news'));
    await settle();
    wait(5000);

    expect(nowPlaying()).toBe(trackUrl('t1'));
    expect(listening().isPlaying).toBe(false);
    expect(listening().currentRepetition).toBe(1);
    expect(
      within(screen.getByRole('button', { name: 'Open listening player' })).getByRole('button', {
        name: 'Play',
      })
    ).toBeInTheDocument();
  });
});

describe('listening never changes review progress', () => {
  test('a whole session leaves every review store and saved card untouched', async () => {
    const fixture = sentencesFixture();
    const before = structuredClone(fixture.sentenceStores);
    await openHub({ ordering: 'recently-added' }, () => fixture);
    await startListening();

    for (let card = 0; card < 4; card++) {
      endClip();
      wait(2000);
      if (listening().currentRepetition === 2) {
        endClip();
        wait(2000);
      }
    }
    await settle();

    expect(listening().isActive).toBe(false);
    expect(srsWrites).not.toHaveBeenCalled();
    expect(fixture.sentenceStores).toEqual(before);
    expect(await userDb.reviewCards.count()).toBe(0);
    const writes = remote.callsTo(
      'setDoc',
      'updateDoc',
      'deleteDoc',
      'batch.commit',
      'runTransaction'
    );
    expect(writes.every((w) => w.includes('/data/listening'))).toBe(true);
  });
});

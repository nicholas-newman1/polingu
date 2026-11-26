import { beforeEach, describe, expect, test, vi } from 'vitest';
import { click, renderApp, settle, setupReviewUi, until } from './support/app';
import { State, reviewCardDueIn, seed, storedCard, storedDoc, verb } from './support/content';
import { browser } from './support/browser';
import { finishedState, reviewSession } from './support/session';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

beforeEach(() => {
  // Each card picks at random which verb of the pair to show first: show the card's own verb.
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
});

const PROGRESS = 'aspectPairsReviewCards';

const robic = verb('robic', 'robi', 'do', { aspectPair: 'zrobic' });
const zrobic = verb('zrobic', 'zrobi', 'do', { aspect: 'Perfective', aspectPair: 'robic' });
const pisac = verb('pisac', 'pisa', 'write', { aspectPair: 'napisac' });
const napisac = verb('napisac', 'napisa', 'write', { aspect: 'Perfective', aspectPair: 'pisac' });

/** Opens Aspect Pairs from the dashboard, the way a learner gets there. */
async function openFromDashboard() {
  const app = renderApp('/dashboard');
  const card = await until(() => app.page.getByRole('button', { name: /Aspect Pairs/ }));
  await settle();
  click(card);
  await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
  return { ...app, session: reviewSession(app.page) };
}

const question = (page: ReturnType<typeof renderApp>['page']) =>
  page.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);

describe('aspect pairs review', () => {
  test('asks for the partner of a verb, reveals it with its aspect, and saves the rating', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);

    const { page, session } = await openFromDashboard();
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(question(page)).toEqual(['napisać']);

    session.reveal();
    expect(page.getByText('Perfective')).toBeInTheDocument();
    expect(page.getByText('Imperfective:')).toBeInTheDocument();
    expect(page.getByRole('heading', { level: 5, name: 'pisać' })).toBeInTheDocument();
    expect(page.getByText('to write')).toBeInTheDocument();

    await session.rate('Good');
    expect(question(page)).toEqual(['robić']);
    await settle();
    expect(storedCard(PROGRESS, 'napisac')?.state).toBe(State.Learning);
    expect(storedDoc('aspectPairsReviewSession')).toMatchObject({ newCardsToday: ['napisac'] });
  });

  test('due pairs come first, and pairs not yet due are left out', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);
    seed.progress(PROGRESS, 'robic', 'verbId', reviewCardDueIn(-1));
    seed.progress(PROGRESS, 'napisac', 'verbId', reviewCardDueIn(6));

    const { page, session } = await openFromDashboard();
    expect(session.status()).toBe('1 reviews · 0 new · 1 remaining');
    expect(question(page)).toEqual(['robić']);
  });

  test('a biaspectual verb is explained as such', async () => {
    const byc = verb('zdrowiec', 'zdrowie', 'heal', { aspectPair: 'zdrowiec' });
    seed.verbs(byc);

    const { page, session } = await openFromDashboard();
    session.reveal();
    expect(page.getByText(/This verb is biaspectual/)).toBeInTheDocument();
  });

  test('new pairs per day restarts the session and is saved', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);
    seed.userDoc('aspectPairsSettings', { newCardsPerDay: 1 });

    const { page, session } = await openFromDashboard();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    session.openSettings();
    session.setNewCardsPerDay('2');

    expect(await until(() => page.getByText(/0 reviews · 2 new/))).toBeInTheDocument();
    await settle();
    expect(storedDoc('aspectPairsSettings')).toMatchObject({ newCardsPerDay: 2 });
  });

  test('Previous Card shows the last pair answered, and reassessing replaces its rating', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);

    const { page, session } = await openFromDashboard();
    session.reveal();
    await session.rate('Hard');
    session.goBack();
    expect(page.getByRole('heading', { level: 5, name: 'pisać' })).toBeInTheDocument();

    await session.rate('Easy');
    expect(question(page)).toEqual(['robić']);
    await settle();
    expect(storedCard(PROGRESS, 'napisac')).toMatchObject({ state: State.Review, reps: 1 });
  });

  test('after the session, Learn new adds pairs beyond the daily limit', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);
    seed.userDoc('aspectPairsSettings', { newCardsPerDay: 1 });

    const { page, session } = await openFromDashboard();
    session.reveal();
    await session.rate('Good');

    click(finishedState(page).learnNew().start);
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(question(page)).toEqual(['robić']);
  });

  test('drill mode cycles through every pair without saving progress', async () => {
    seed.verbs(pisac, napisac, robic, zrobic);

    const { page, session } = await openFromDashboard();
    session.toggleDrill();
    expect(session.status()).toBe('Drill Mode · 2 pairs');
    session.reveal();
    await session.nextDrillCard();
    expect(question(page)).toEqual(['robić']);
    await settle();
    expect(storedCard(PROGRESS, 'napisac')).toBeUndefined();
  });

  test('with auto-play on, the asked verb plays on open and its partner on reveal', async () => {
    seed.verbs(
      { ...pisac, infinitiveAudioUrl: 'https://audio.test/pisac.mp3' },
      { ...napisac, infinitiveAudioUrl: 'https://audio.test/napisac.mp3' }
    );
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });

    const { page, session } = await openFromDashboard();
    await settle();
    expect(browser.played).toEqual(['https://audio.test/napisac.mp3']);

    session.reveal();
    await settle();
    expect(browser.played).toEqual([
      'https://audio.test/napisac.mp3',
      'https://audio.test/pisac.mp3',
    ]);

    // Pressing play while a verb is playing stops it; each verb has its own button.
    click(page.getByRole('button', { name: 'Stop audio' }));
    expect(page.getAllByRole('button', { name: 'Play audio' })).toHaveLength(2);
    click(page.getAllByRole('button', { name: 'Play audio' })[0]);
    expect(browser.played.at(-1)).toBe('https://audio.test/napisac.mp3');
  });

  test('audio-only mode hides both verbs until the answer is revealed', async () => {
    seed.verbs(
      { ...pisac, infinitiveAudioUrl: 'https://audio.test/pisac.mp3' },
      { ...napisac, infinitiveAudioUrl: 'https://audio.test/napisac.mp3' }
    );
    seed.userDoc('appSettings', { autoPlayAudio: false, hidePolishText: true });

    const { page, session } = await openFromDashboard();
    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
    expect(page.queryByText('napisać')).not.toBeInTheDocument();
    session.reveal();
    expect(question(page)).toEqual(['napisać']);
  });

  test('shows a message when no verb has an aspect partner', async () => {
    seed.verbs(verb('czytac', 'czyta', 'read'));

    const { page } = renderApp('/aspect-pairs');
    await settle();
    expect(
      page.getByText('No aspect pairs available. Verbs need aspectPair data to drill.')
    ).toBeInTheDocument();
  });

  test('opening the page directly shows the pairs that are due', async () => {
    seed.verbs(pisac, napisac);

    const { page } = renderApp('/aspect-pairs');
    await settle();
    expect(page.getByRole('button', { name: 'Reveal Answer' })).toBeInTheDocument();
  });
});

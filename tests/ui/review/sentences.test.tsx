import { describe, expect, test, vi } from 'vitest';
import { within } from '@testing-library/react';
import { click, currentPath, renderApp, settle, setupReviewUi, until } from './support/app';
import { State, reviewCardDueIn, seed, sentence, storedCard, storedDoc } from './support/content';
import { finishedState, reviewSession, sentenceText } from './support/session';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const PL_EN = 'sentenceReviewCards-pl-en';

const kot = sentence('s1', 'Mam kota.', 'I have a cat.');
const kawa = sentence('s2', 'Lubię kawę.', 'I like coffee.', { level: 'A2' });
const ksiazka = sentence('s3', 'Czytam książkę.', 'I am reading a book.', {
  level: 'B1',
  tags: ['hobbies'],
});

async function openDeck(path = '/sentences/recognition') {
  const app = renderApp(path);
  await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
  await settle();
  return { ...app, session: reviewSession(app.page) };
}

const levelChip = (page: ReturnType<typeof renderApp>['page'], level: string) =>
  page.getByRole('button', { name: level });

/** The card on screen (the level filter chips above it also show levels). */
const card = (container: HTMLElement) => {
  const wrapper = container.querySelector<HTMLElement>('[data-card-wrapper]');
  if (!wrapper) throw new Error('No card on screen');
  return within(wrapper);
};

describe('sentence review', () => {
  test('recognition shows the Polish sentence and its level, reveals the English, and saves the rating', async () => {
    seed.sentences(kot, kawa);

    const { page, container, session } = await openDeck();
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(sentenceText(page, 'Mam kota.')).toBeInTheDocument();
    expect(card(container).getByText('A1')).toBeInTheDocument();
    expect(page.queryByText('I have a cat.')).not.toBeInTheDocument();

    session.reveal();
    expect(page.getByText('I have a cat.')).toBeInTheDocument();
    await session.rate('Good');

    expect(sentenceText(page, 'Lubię kawę.')).toBeInTheDocument();
    expect(card(container).getByText('A2')).toBeInTheDocument();
    await settle();
    expect(storedCard(PL_EN, 's1')?.state).toBe(State.Learning);
    expect(storedDoc('sentenceReviewSession-pl-en')).toMatchObject({ newCardsToday: ['s1'] });
  });

  test('production asks in English with the topic tags, and reveals the Polish', async () => {
    seed.sentences(ksiazka);

    const { page, session } = await openDeck('/sentences/production');
    expect(page.getByText('I am reading a book.')).toBeInTheDocument();
    expect(page.getByText('hobbies')).toBeInTheDocument();
    expect(page.queryByText('Czytam')).not.toBeInTheDocument();

    session.reveal();
    expect(sentenceText(page, 'Czytam książkę.')).toBeInTheDocument();
    await session.rate('Good');
    await settle();
    expect(storedCard('sentenceReviewCards-en-pl', 's3')?.state).toBe(State.Learning);
    expect(storedCard(PL_EN, 's3')).toBeUndefined();
  });

  test('audio-only mode hides the Polish sentence until it is revealed', async () => {
    seed.sentences({ ...kot, audioUrl: 'https://audio.test/s1.mp3' });
    seed.userDoc('appSettings', { autoPlayAudio: false, hidePolishText: true });

    const { page, session } = await openDeck();
    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
    expect(page.queryByText('Mam')).not.toBeInTheDocument();
    session.reveal();
    expect(sentenceText(page, 'Mam kota.')).toBeInTheDocument();
  });
});

describe('going back and finishing', () => {
  test('Previous Card shows the last sentence answered, and reassessing replaces its rating', async () => {
    seed.sentences(kot, kawa);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Again');
    session.goBack();
    expect(page.getByText('I have a cat.')).toBeInTheDocument();

    await session.rate('Easy');
    expect(sentenceText(page, 'Lubię kawę.')).toBeInTheDocument();
    expect(session.status()).toBe('0 reviews · 2 new · 1 remaining');
    await settle();
    expect(storedCard(PL_EN, 's1')).toMatchObject({ state: State.Review, reps: 1 });
  });

  test('after the session, Learn new adds sentences beyond the daily limit', async () => {
    seed.sentences(kot, kawa, ksiazka);
    seed.userDoc('sentenceSettings-pl-en', {
      newCardsPerDay: 1,
      selectedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    });

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');

    click(finishedState(page).learnNew().start);
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(sentenceText(page, 'Lubię kawę.')).toBeInTheDocument();
  });
});

describe('sentence levels', () => {
  test('switching a level off restarts the session without it and saves the choice', async () => {
    seed.sentences(kot, kawa, ksiazka);
    seed.progress(PL_EN, 's2', 'sentenceId', reviewCardDueIn(-1));

    const { page, session } = await openDeck();
    expect(session.status()).toBe('1 reviews · 2 new · 3 remaining');

    click(levelChip(page, 'A2'));
    expect(await until(() => page.getByText(/0 reviews · 2 new/))).toBeInTheDocument();
    expect(sentenceText(page, 'Mam kota.')).toBeInTheDocument();
    await settle();
    expect(storedDoc('sentenceSettings-pl-en')).toMatchObject({
      selectedLevels: ['A1', 'B1', 'B2', 'C1', 'C2'],
    });

    click(levelChip(page, 'A2'));
    expect(await until(() => page.getByText(/1 reviews · 2 new/))).toBeInTheDocument();
  });

  test('the last selected level cannot be switched off', async () => {
    seed.sentences(kot, kawa);
    seed.userDoc('sentenceSettings-pl-en', { newCardsPerDay: 5, selectedLevels: ['A1'] });

    const { page, session } = await openDeck();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');

    click(levelChip(page, 'A1'));
    await settle();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(storedDoc('sentenceSettings-pl-en')).toMatchObject({ selectedLevels: ['A1'] });
  });

  test('in drill mode the level chips choose which sentences are drilled', async () => {
    seed.sentences(kot, kawa, ksiazka);

    const { page, session } = await openDeck();
    session.toggleDrill();
    expect(session.status()).toBe('Drill Mode · 3 sentences');
    expect(page.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();

    click(levelChip(page, 'A1'));
    expect(await until(() => page.getByText('Drill Mode · 2 sentences'))).toBeInTheDocument();
    expect(sentenceText(page, 'Lubię kawę.')).toBeInTheDocument();
  });

  test('the mode picker breaks progress down by level and opens a direction', async () => {
    seed.sentences(kot, kawa, ksiazka);
    seed.progress(PL_EN, 's1', 'sentenceId', reviewCardDueIn(5));

    const { page } = renderApp('/sentences');
    const recognition = await until(() => page.getByRole('button', { name: /Recognition/ }));
    await settle();

    const levelRow = (level: string) =>
      within(recognition).getByText(level).parentElement?.textContent?.replace(/\s/g, '');
    expect(levelRow('A1')).toBe('A11/1');
    expect(levelRow('A2')).toBe('A20/1');
    expect(levelRow('B1')).toBe('B10/1');
    expect(levelRow('C2')).toBe('C20/0');

    click(page.getByRole('button', { name: /Production/ }));
    expect(currentPath()).toBe('/sentences/production');
  });
});

describe('sentence settings', () => {
  test('new sentences per day restarts the session with the new limit and is saved', async () => {
    seed.sentences(kot, kawa, ksiazka);

    const { page, session } = await openDeck();
    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');
    session.openSettings();
    session.setNewCardsPerDay('1');

    expect(await until(() => page.getByText(/0 reviews · 1 new/))).toBeInTheDocument();
    await settle();
    expect(storedDoc('sentenceSettings-pl-en')).toMatchObject({ newCardsPerDay: 1 });
  });
});

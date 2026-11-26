import { describe, expect, test, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { click, currentPath, renderApp, settle, setupReviewUi, until } from './support/app';
import {
  State,
  declensionCard,
  reviewCardDueIn,
  seed,
  storedCard,
  storedDoc,
} from './support/content';
import { browser } from './support/browser';
import {
  chooseFilter,
  filterChip,
  finishedState,
  reviewSession,
  sentenceText,
} from './support/session';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const PROGRESS = 'declensionReviewCards';

const kawa = declensionCard(1, 'Nie ma (kawa)', 'Nie ma kawy.', 'kawy', {
  english: 'There is no coffee.',
  hint: 'Negation takes the genitive',
  audioUrl: 'https://audio.test/declension-1.mp3',
});
const sklep = declensionCard(2, 'Idę do (sklep)', 'Idę do sklepu.', 'sklepu', {
  gender: 'Masculine',
});
const pies = declensionCard(3, 'Daję kość (pies)', 'Daję kość psu.', 'psu', {
  case: 'Dative',
  gender: 'Masculine',
});
const koty = declensionCard(4, 'Widzę (kot)', 'Widzę koty.', 'koty', {
  case: 'Accusative',
  gender: 'Masculine',
  number: 'Plural',
});

async function openDeclension() {
  const app = renderApp('/declension');
  await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
  await settle();
  return { ...app, session: reviewSession(app.page) };
}

describe('declension review', () => {
  test('shows the prompt, then the declined sentence with its grammar, and saves the rating', async () => {
    seed.declensionCards(kawa, sklep);

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(sentenceText(page, 'Nie ma (kawa)')).toBeInTheDocument();
    expect(page.queryByText('There is no coffee.')).not.toBeInTheDocument();

    session.reveal();
    expect(sentenceText(page, 'Nie ma kawy.')).toBeInTheDocument();
    expect(page.getByText('There is no coffee.')).toBeInTheDocument();
    for (const label of ['Genitive', 'Feminine', 'Singular']) {
      expect(page.getByText(label)).toBeInTheDocument();
    }
    expect(page.getByText(/Negation takes the genitive/)).toBeInTheDocument();
    expect(session.intervals().Good).toBe('10m');

    await session.rate('Good');
    expect(sentenceText(page, 'Idę do (sklep)')).toBeInTheDocument();
    await settle();
    expect(storedCard(PROGRESS, 1)?.state).toBe(State.Learning);
    expect(storedDoc('declensionReviewSession')).toMatchObject({ newCardsToday: [1] });
  });

  test('due reviews come before new cards', async () => {
    seed.declensionCards(kawa, sklep);
    seed.progress(PROGRESS, 2, 'cardId', reviewCardDueIn(-2));

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    expect(sentenceText(page, 'Idę do (sklep)')).toBeInTheDocument();
  });

  test('with auto-play on, the sentence plays once the answer is revealed', async () => {
    seed.declensionCards(kawa);
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });

    const { session } = await openDeclension();
    expect(browser.played).toEqual([]);
    session.reveal();
    await settle();
    expect(browser.played).toEqual([kawa.audioUrl]);
  });
});

describe('going back and finishing', () => {
  test('Previous Card shows the last card answered, and reassessing replaces its rating', async () => {
    seed.declensionCards(kawa, sklep);

    const { page, session } = await openDeclension();
    session.reveal();
    await session.rate('Hard');
    session.goBack();
    expect(sentenceText(page, 'Nie ma kawy.')).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Continue →' })).toBeInTheDocument();

    await session.rate('Easy');
    expect(sentenceText(page, 'Idę do (sklep)')).toBeInTheDocument();
    await settle();
    expect(storedCard(PROGRESS, 1)).toMatchObject({ state: State.Review, reps: 1 });
  });

  test('after the session, Learn new adds unseen cards and Review early drills cards not yet due', async () => {
    seed.declensionCards(kawa, sklep, pies);
    seed.progress(PROGRESS, 3, 'cardId', reviewCardDueIn(5));
    seed.userDoc('settings', { newCardsPerDay: 1 });

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    session.reveal();
    await session.rate('Good');

    const finished = finishedState(page);
    expect(finished.heading()).toBe('All done!');
    click(finished.learnNew().start);
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(sentenceText(page, 'Idę do (sklep)')).toBeInTheDocument();
    session.reveal();
    await session.rate('Good');

    click(finished.reviewEarly().start);
    expect(session.status()).toBe('Drill Ahead · 1 remaining');
    expect(sentenceText(page, 'Daję kość (pies)')).toBeInTheDocument();
  });
});

describe('declension filters', () => {
  test('a case filter restarts the session with matching cards and is remembered', async () => {
    seed.declensionCards(kawa, sklep, pies, koty);

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('0 reviews · 4 new · 4 remaining');

    await chooseFilter(page, 'Case', 'Dative');
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(sentenceText(page, 'Daję kość (pies)')).toBeInTheDocument();
    expect(filterChip(page, 'Dative')).toBeInTheDocument();
    await settle();
    expect(storedDoc('userFilters')).toMatchObject({
      declension: { cases: ['Dative'], genders: [], number: 'All' },
    });

    click(filterChip(page, 'Dative'));
    expect(session.status()).toBe('0 reviews · 4 new · 4 remaining');
    expect(page.queryByRole('button', { name: 'Dative' })).not.toBeInTheDocument();
    await settle();
    expect(storedDoc('userFilters')).toMatchObject({ declension: { cases: [] } });
  });

  test('Clear removes a number filter', async () => {
    seed.declensionCards(kawa, koty);

    const { page, session } = await openDeclension();
    await chooseFilter(page, 'Number', 'Plural');
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');

    click(page.getByRole('button', { name: 'Clear' }));
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(page.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  test('Clear removes case and gender filters too', async () => {
    seed.declensionCards(kawa, sklep, pies, koty);

    const { page, session } = await openDeclension();
    await chooseFilter(page, 'Case', 'Dative');

    click(page.getByRole('button', { name: 'Clear' }));
    expect(session.status()).toBe('0 reviews · 4 new · 4 remaining');
    expect(page.queryByRole('button', { name: 'Dative' })).not.toBeInTheDocument();
  });

  test('gender and number filters combine, and removing a chip removes that filter', async () => {
    seed.declensionCards(kawa, sklep, pies, koty);

    const { page, session } = await openDeclension();
    await chooseFilter(page, 'Gender', 'Masculine');
    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');

    await chooseFilter(page, 'Number', 'Plural');
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(sentenceText(page, 'Widzę (kot)')).toBeInTheDocument();

    click(filterChip(page, 'Plural'));
    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');
  });

  test('filters never hide a review that is due', async () => {
    seed.declensionCards(kawa, sklep, pies);
    seed.progress(PROGRESS, 1, 'cardId', reviewCardDueIn(-1));

    const { page, session } = await openDeclension();
    await chooseFilter(page, 'Case', 'Dative');
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    expect(sentenceText(page, 'Nie ma (kawa)')).toBeInTheDocument();
  });

  test('saved filters apply when the page opens', async () => {
    seed.declensionCards(kawa, sklep, pies, koty);
    seed.userDoc('userFilters', {
      declension: { cases: ['Accusative'], genders: [], number: 'All' },
    });

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(filterChip(page, 'Accusative')).toBeInTheDocument();
  });

  test('drill mode only uses cards matching the filters, and says so when none match', async () => {
    seed.declensionCards(kawa, sklep, pies);

    const { page, session } = await openDeclension();
    await chooseFilter(page, 'Case', 'Dative');
    session.toggleDrill();
    expect(session.status()).toBe('Drill Mode · 1 cards');
    expect(sentenceText(page, 'Daję kość (pies)')).toBeInTheDocument();

    await chooseFilter(page, 'Gender', 'Neuter');
    expect(page.getByText('No cards match your filters')).toBeInTheDocument();
    expect(session.status()).toBe('Drill Mode · 0 cards');
  });
});

describe('declension filter accessibility', () => {
  test('the filter dropdowns are named after their labels', async () => {
    seed.declensionCards(kawa);
    const { page } = await openDeclension();
    for (const name of ['Case', 'Gender', 'Number']) {
      expect(page.getByRole('combobox', { name })).toBeInTheDocument();
    }
  });
});

describe('audio-only mode on declension cards', () => {
  test('hiding Polish text changes the card before it is revealed', async () => {
    seed.declensionCards(kawa);
    const { page } = await openDeclension();
    click(page.getByRole('button', { name: 'Hide Polish text' }));
    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
  });
});

describe('without declension cards', () => {
  test('says there are no cards to drill instead of loading forever', async () => {
    const { page } = renderApp('/declension');
    await settle();
    expect(page.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(page.getByText('No declension cards available.')).toBeVisible();
    expect(page.getByRole('button', { name: 'Add custom card' })).toBeInTheDocument();
  });
});

describe('declension settings', () => {
  test('new cards per day is saved', async () => {
    seed.declensionCards(kawa, sklep, pies);
    seed.userDoc('settings', { newCardsPerDay: 1 });

    const { page, session } = await openDeclension();
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    session.openSettings();
    expect(page.getByRole('spinbutton')).toHaveValue(1);
    session.setNewCardsPerDay('3');
    await settle();
    expect(storedDoc('settings')).toEqual({ newCardsPerDay: 3 });
  });

  test('changing new cards per day takes effect in the current session', async () => {
    seed.declensionCards(kawa, sklep, pies);
    seed.userDoc('settings', { newCardsPerDay: 1 });

    const { session } = await openDeclension();
    session.openSettings();
    session.setNewCardsPerDay('3');
    await settle();
    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');
  });
});

describe('declension listening', () => {
  test('starts the listening player with the cards that have audio', async () => {
    seed.declensionCards(kawa, sklep);
    const { page } = await openDeclension();
    click(page.getByRole('button', { name: 'Start listening mode' }));
    expect(currentPath()).toBe('/listen/play');
    const queue = screen.getByRole('list', { name: 'Listening queue' });
    expect(
      within(queue)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['kawy']);
  });

  test('explains when no card matching the filters has audio', async () => {
    seed.declensionCards(sklep);
    const { page } = await openDeclension();
    click(page.getByRole('button', { name: 'Start listening mode' }));
    expect(await until(() => screen.getByRole('alert'))).toHaveTextContent(
      'No declensions with audio for the current filters.'
    );
    expect(currentPath()).toBe('/declension');
  });
});

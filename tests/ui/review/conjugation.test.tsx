import { describe, expect, test, vi } from 'vitest';
import { click, currentPath, renderApp, settle, setupReviewUi, until } from './support/app';
import { State, reviewCardDueIn, seed, storedCard, storedDoc, verb } from './support/content';
import {
  chooseFilter,
  deckStats,
  filterChip,
  finishedState,
  reviewSession,
} from './support/session';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const PL_EN = 'conjugationReviewForms-pl-en';
const EN_PL = 'conjugationReviewForms-en-pl';

const czytac = verb('czytac', 'czyta', 'read');

async function openDeck(path = '/conjugation/recognition') {
  const app = renderApp(path);
  await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
  await settle();
  return { ...app, session: reviewSession(app.page) };
}

const shownForm = (page: ReturnType<typeof renderApp>['page']) =>
  page.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);

describe('conjugation review', () => {
  test('recognition shows a Polish form and reveals its English meaning; the rating is saved', async () => {
    seed.verbs(czytac);

    const { page, session } = await openDeck();
    expect(session.status()).toBe('0 reviews · 6 new · 6 remaining');
    expect(shownForm(page)).toEqual(['czytam']);
    expect(page.getByText('czytać')).toBeInTheDocument();

    session.reveal();
    expect(page.getByRole('heading', { name: 'I read' })).toBeInTheDocument();
    expect(page.getByText(/Imperfective/)).toBeInTheDocument();

    await session.rate('Good');
    expect(shownForm(page)).toEqual(['czytasz']);
    await settle();
    expect(storedCard(PL_EN, 'czytac:present:1sg')?.state).toBe(State.Learning);
    expect(storedDoc('conjugationReviewSession-pl-en')).toMatchObject({
      newFormsToday: ['czytac:present:1sg'],
    });
  });

  test('production asks in English with the tense, and keeps its own progress', async () => {
    seed.verbs(czytac);
    const recognitionProgress = reviewCardDueIn(20);
    seed.progress(PL_EN, 'czytac:present:1sg', 'formKey', recognitionProgress);

    const { page, session } = await openDeck('/conjugation/production');
    expect(shownForm(page)).toEqual(['I read']);
    expect(page.getByText('● Present')).toBeInTheDocument();

    session.reveal();
    expect(page.getByRole('heading', { name: 'czytam' })).toBeInTheDocument();
    await session.rate('Easy');
    await settle();
    expect(storedCard(EN_PL, 'czytac:present:1sg')?.state).toBe(State.Review);
    expect(storedCard(PL_EN, 'czytac:present:1sg')?.due).toEqual(recognitionProgress.due);
  });

  test('the answer shows the matching form of the aspect partner', async () => {
    const przeczytac = verb('przeczytac', 'przeczyta', 'read through', {
      aspect: 'Perfective',
      aspectPair: 'czytac',
      conjugations: {},
    });
    przeczytac.conjugations.future = verb('x', 'przeczyta', 'will read').conjugations
      .present as typeof przeczytac.conjugations.future;
    seed.verbs({ ...czytac, aspectPair: 'przeczytac' }, przeczytac);

    const { page, session } = await openDeck();
    session.reveal();
    expect(page.getByText('przeczytam').closest('p')).toHaveTextContent('Perfective: przeczytam');
  });

  test('the mode picker shows each direction’s due forms and opens it', async () => {
    seed.verbs(czytac);
    seed.progress(PL_EN, 'czytac:present:1sg', 'formKey', reviewCardDueIn(-1));
    seed.userDoc('conjugationSettings-en-pl', { newCardsPerDay: 2 });

    const { page } = renderApp('/conjugation');
    const recognition = await until(() => page.getByRole('button', { name: /Recognition/ }));
    await settle();
    expect(deckStats(recognition)).toEqual({ due: 6, learned: 1, total: 6 });
    const production = page.getByRole('button', { name: /Production/ });
    expect(deckStats(production)).toEqual({ due: 2, learned: 0, total: 6 });

    click(recognition);
    expect(currentPath()).toBe('/conjugation/recognition');
  });
});

describe('going back, finishing and audio-only mode', () => {
  test('Previous Card shows the last form answered, and reassessing replaces its rating', async () => {
    seed.verbs(czytac);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Hard');
    session.goBack();
    expect(page.getByRole('heading', { name: 'I read' })).toBeInTheDocument();

    await session.rate('Easy');
    expect(shownForm(page)).toEqual(['czytasz']);
    await settle();
    expect(storedCard(PL_EN, 'czytac:present:1sg')).toMatchObject({
      state: State.Review,
      reps: 1,
    });
  });

  test('after the session, Review early drills forms that are not due yet', async () => {
    seed.verbs(czytac);
    seed.progress(PL_EN, 'czytac:present:3sg', 'formKey', reviewCardDueIn(5));
    seed.userDoc('conjugationSettings-pl-en', { newCardsPerDay: 1 });

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');

    click(finishedState(page).reviewEarly().start);
    expect(session.status()).toBe('Drill Ahead · 1 remaining');
    expect(shownForm(page)).toEqual(['czyta']);
  });

  test('audio-only mode hides the Polish form and its infinitive until revealed', async () => {
    const withAudio = verb('czytac', 'czyta', 'read');
    withAudio.conjugations.present!['1sg'].audioUrl = 'https://audio.test/czytam.mp3';
    seed.verbs(withAudio);
    seed.userDoc('appSettings', { autoPlayAudio: false, hidePolishText: true });

    const { page, session } = await openDeck();
    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
    expect(page.queryByText('czytam')).not.toBeInTheDocument();
    expect(page.queryByText('czytać')).not.toBeInTheDocument();

    session.reveal();
    expect(page.getByRole('heading', { name: 'czytam' })).toBeInTheDocument();
    expect(page.getByText('czytać')).toBeInTheDocument();
  });
});

describe('conjugation filters', () => {
  test('a person filter narrows the session, shows a chip and is remembered', async () => {
    seed.verbs(czytac);

    const { page, session } = await openDeck();
    await chooseFilter(page, 'Person', '1st');

    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    expect(shownForm(page)).toEqual(['czytam']);
    expect(filterChip(page, '1st')).toBeInTheDocument();
    await settle();
    expect(storedDoc('userFilters')).toMatchObject({ conjugation: { persons: ['1st'] } });

    session.reveal();
    await session.rate('Good');
    expect(shownForm(page)).toEqual(['czytamy']);
  });

  test('Clear removes every filter', async () => {
    seed.verbs(czytac);

    const { page, session } = await openDeck();
    await chooseFilter(page, 'Person', '2nd');
    await chooseFilter(page, 'Number', 'Plural');
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');
    expect(shownForm(page)).toEqual(['czytacie']);

    click(page.getByRole('button', { name: 'Clear' }));
    expect(session.status()).toBe('0 reviews · 6 new · 6 remaining');
    expect(page.queryByRole('button', { name: '2nd' })).not.toBeInTheDocument();
  });

  test('a filter that matches no verb leaves nothing new to study', async () => {
    seed.verbs(czytac);

    const { page } = await openDeck();
    await chooseFilter(page, 'Aspect', 'Perfective');
    expect(page.getByRole('heading', { name: /All done!|What's next\?/ })).toBeInTheDocument();
  });

  test('in drill mode a filter change reshuffles the drill deck', async () => {
    seed.verbs(czytac);

    const { page, session } = await openDeck();
    session.toggleDrill();
    expect(session.status()).toBe('Drill Mode · 6 forms');

    await chooseFilter(page, 'Tense', 'Present');
    await chooseFilter(page, 'Person', '3rd');
    expect(session.status()).toBe('Drill Mode · 2 forms');
    session.reveal();
    await session.nextDrillCard();
    expect(shownForm(page)).toEqual(['czytają']);
  });
});

describe('conjugation settings', () => {
  test('new forms per day restarts the session with the new limit and is saved', async () => {
    seed.verbs(czytac);
    seed.userDoc('conjugationSettings-pl-en', { newCardsPerDay: 2 });

    const { page, session } = await openDeck();
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    session.openSettings();
    session.setNewCardsPerDay('4');

    expect(await until(() => page.getByText(/4 new/))).toBeInTheDocument();
    await settle();
    expect(storedDoc('conjugationSettings-pl-en')).toEqual({ newCardsPerDay: 4 });
  });
});

describe('without verbs', () => {
  test('says there are no verbs to drill', async () => {
    const { page } = renderApp('/conjugation/recognition');
    await settle();
    expect(page.getByText('No verbs available. Import verbs to get started.')).toBeVisible();
  });
});

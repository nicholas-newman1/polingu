import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { Link } from 'react-router-dom';
import { fireEvent, screen, within } from '@testing-library/react';
import { click, currentPath, elapse, renderApp, settle, setupReviewUi, until } from './support/app';
import {
  NOW,
  State,
  TODAY,
  reviewCardDueIn,
  seed,
  storedCard,
  storedDoc,
  storedIds,
  word,
} from './support/content';
import { browser } from './support/browser';
import { deckStats, finishedState, reviewSession } from './support/session';
import { network } from '../../sync/support/harness';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const PL_EN = 'vocabularyReviewCards-pl-en';
const EN_PL = 'vocabularyReviewCards-en-pl';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const kot = word(1, 'kot', 'cat');
const pies = word(2, 'pies', 'dog');
const dom = word(3, 'dom', 'house');
const woda = word(4, 'woda', 'water');
const okno = word(5, 'okno', 'window');

const newCardsPerDay = (direction: 'pl-en' | 'en-pl', limit: number) =>
  seed.userDoc(`vocabularySettings-${direction}`, { newCardsPerDay: limit });

/** Opens a vocabulary deck and waits for its first card and the background sync. */
async function openDeck(path = '/vocabulary/recognition', extra?: ReactNode) {
  const app = renderApp(path, extra);
  await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
  await settle();
  return { ...app, session: reviewSession(app.page), finished: finishedState(app.page) };
}

const shownWord = (page: ReturnType<typeof renderApp>['page']) =>
  page.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);

describe('a vocabulary session', () => {
  test('starts with due reviews, then new words up to the daily limit, and skips words not yet due', async () => {
    seed.vocabulary(kot, pies, dom, woda, okno);
    seed.progress(PL_EN, 2, 'wordId', reviewCardDueIn(-1));
    seed.progress(PL_EN, 4, 'wordId', reviewCardDueIn(5));
    newCardsPerDay('pl-en', 2);

    const { page, session, finished } = await openDeck();
    expect(session.status()).toBe('1 reviews · 2 new · 3 remaining');

    const seen: Array<string | null> = [];
    for (let i = 0; i < 3; i++) {
      seen.push(shownWord(page)[0]);
      session.reveal();
      await session.rate('Good');
    }
    expect(seen).toEqual(['pies', 'kot', 'dom']);
    expect(finished.heading()).toBe("What's next?");
  });

  test('reveal shows the answer, and the rating buttons say when the word would come back', async () => {
    seed.vocabulary(word(1, 'kot', 'cat', { partOfSpeech: 'noun', gender: 'masculine' }));

    const { page, session } = await openDeck();
    expect(page.getByRole('heading', { name: 'kot' })).toBeInTheDocument();
    expect(page.queryByText('cat')).not.toBeInTheDocument();
    expect(session.hasRatingButtons()).toBe(false);

    session.reveal();
    expect(page.getByRole('heading', { name: 'cat' })).toBeInTheDocument();
    expect(page.getByText('Noun')).toBeInTheDocument();
    expect(page.getByText('masculine')).toBeInTheDocument();
    expect(session.intervals()).toEqual({ Again: '1m', Hard: '6m', Good: '10m', Easy: '8d' });
  });

  test('a review word shows longer intervals than a new one', async () => {
    seed.vocabulary(kot);
    seed.progress(PL_EN, 1, 'wordId', reviewCardDueIn(-1));

    const { session } = await openDeck();
    session.reveal();
    const intervals = session.intervals();
    expect(intervals.Again).toBe('10m');
    expect(intervals.Good).toMatch(/^\d+d$/);
    expect(parseInt(intervals.Easy)).toBeGreaterThan(parseInt(intervals.Good));
  });

  test('rating a word moves to the next one and saves the review to the server', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');

    expect(page.getByRole('heading', { name: 'pies' })).toBeInTheDocument();
    expect(session.status()).toBe('0 reviews · 2 new · 1 remaining');
    expect(page.getByRole('progressbar', { name: 'Session progress' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );

    await settle();
    const saved = storedCard(PL_EN, 1);
    expect(saved?.state).toBe(State.Learning);
    expect(saved?.due.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 10 * MINUTE);
    expect(storedCard(PL_EN, 2)).toBeUndefined();
    expect(storedDoc('vocabularyReviewSession-pl-en')).toMatchObject({
      lastReviewDate: TODAY,
      newCardsToday: [1],
      reviewedToday: [1],
    });
  });

  test('the rated card animates away over the next one, then is removed', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    click(page.getByRole('button', { name: /^Good/ }));

    // The outgoing card is a decorative copy, hidden from assistive technology.
    expect(page.queryByText('kot')).not.toBeInTheDocument();
    const leaving = screen.getByText('kot');
    expect(leaving.closest('[aria-hidden="true"]')).not.toBeNull();

    await elapse(450);
    expect(screen.queryByText('kot')).not.toBeInTheDocument();
  });

  test('with reduced motion the next card appears without an exit animation', async () => {
    seed.vocabulary(kot, pies);
    browser.reducedMotion = true;

    const { session } = await openDeck();
    session.reveal();
    click(screen.getByRole('button', { name: /^Good/ }));

    expect(screen.queryByText('kot')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'pies' })).toBeInTheDocument();
  });

  test('up to two cards peek out behind the current one, one per word still to come', async () => {
    seed.vocabulary(kot, pies, dom);

    const { container, session } = await openDeck();
    // The stacked cards behind the current one are decorative layers.
    const stackDepth = () =>
      container.querySelectorAll('[data-card-wrapper] > [aria-hidden="true"]').length;
    expect(stackDepth()).toBe(2);

    session.reveal();
    await session.rate('Good');
    expect(stackDepth()).toBe(1);
    session.reveal();
    await session.rate('Good');
    expect(stackDepth()).toBe(0);
  });

  test('Again keeps the word in the session until it is recalled', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Again');
    expect(shownWord(page)).toEqual(['pies']);
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');

    session.reveal();
    await session.rate('Good');
    expect(shownWord(page)).toEqual(['kot']);

    session.reveal();
    await session.rate('Good');
    await settle();
    expect(storedDoc('vocabularyReviewSession-pl-en')?.reviewedToday).toEqual([2, 1]);
    expect(page.getByRole('heading', { name: /What's next\?|All done!/ })).toBeInTheDocument();
  });
});

describe('the daily loop', () => {
  test('reopening the deck later the same day starts no new words beyond the daily limit', async () => {
    seed.vocabulary(kot, pies, dom);
    newCardsPerDay('pl-en', 2);
    newCardsPerDay('en-pl', 0);

    const morning = await openDeck();
    for (let i = 0; i < 2; i++) {
      morning.session.reveal();
      await morning.session.rate('Good');
    }
    morning.unmount();
    await settle();

    vi.setSystemTime(NOW.getTime() + 3 * 60 * MINUTE);
    const { page } = renderApp('/vocabulary/recognition');
    await settle();
    expect(page.getByRole('heading', { name: 'All done!' })).toBeInTheDocument();
    expect(page.queryByText('dom')).not.toBeInTheDocument();
  });

  test('the next day, yesterday’s words come back first and new words are offered again', async () => {
    seed.vocabulary(kot, pies, dom, woda);
    newCardsPerDay('pl-en', 2);

    const today = await openDeck();
    for (let i = 0; i < 2; i++) {
      today.session.reveal();
      await today.session.rate('Good');
    }
    today.unmount();
    await settle();

    vi.setSystemTime(NOW.getTime() + DAY);
    const { page, session } = await openDeck();
    expect(session.status()).toBe('2 reviews · 2 new · 4 remaining');
    const seen: Array<string | null> = [];
    for (let i = 0; i < 4; i++) {
      seen.push(shownWord(page)[0]);
      session.reveal();
      await session.rate('Good');
    }
    expect(seen).toEqual(['kot', 'pies', 'dom', 'woda']);
    await settle();
    expect(storedDoc('vocabularyReviewSession-pl-en')).toMatchObject({
      lastReviewDate: '2026-03-11',
      newCardsToday: [3, 4],
    });
  });

  test('a rating is saved even when the learner leaves the deck straight away', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck(
      '/vocabulary/recognition',
      <Link to="/dashboard">Home</Link>
    );
    session.reveal();
    // The save waits for the card's exit animation; the clock does not move here.
    click(page.getByRole('button', { name: /^Good/ }));
    click(page.getByRole('link', { name: 'Home' }));
    await settle();

    expect(currentPath()).toBe('/dashboard');
    expect(storedCard(PL_EN, 1)?.state).toBe(State.Learning);
    expect(storedDoc('vocabularyReviewSession-pl-en')).toMatchObject({ reviewedToday: [1] });
  });

  test('a rating is saved when the app is put away before its save would have run', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    click(page.getByRole('button', { name: /^Good/ }));
    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(storedCard(PL_EN, 1)?.state).toBe(State.Learning);
  });

  test('words rated offline reach the server when the learner comes back online', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    network.goOffline();
    session.reveal();
    await session.rate('Good');
    await settle();
    expect(shownWord(page)).toEqual(['pies']);
    expect(storedCard(PL_EN, 1)).toBeUndefined();

    network.goOnline();
    // Returning to the app (focus or a visibility change) syncs what was saved offline.
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(storedCard(PL_EN, 1)?.state).toBe(State.Learning);
    expect(storedDoc('vocabularyReviewSession-pl-en')).toMatchObject({
      newCardsToday: [1],
      reviewedToday: [1],
    });
  });

  test('a deck opened offline works from what the last visit cached', async () => {
    seed.vocabulary(kot, pies);
    // The built-in content always has sentences; the content cache is trusted only then.
    seed.sentences({
      id: 's1',
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
      tags: [],
    });
    seed.progress(PL_EN, 2, 'wordId', reviewCardDueIn(-1));
    const online = await openDeck();
    online.unmount();
    await settle();

    network.goOffline();
    const { page, session } = await openDeck();
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    expect(shownWord(page)).toEqual(['pies']);
  });
});

describe('opening a deck', () => {
  test('goes straight from loading to the first card', async () => {
    seed.vocabulary(kot);
    browser.reducedMotion = true;
    const shown: string[] = [];
    const observer = new MutationObserver(() => {
      const text = document.body.textContent ?? '';
      if (/All done!|What's next\?/.test(text)) shown.push('finished state');
      if (text.includes('Reveal Answer')) shown.push('card');
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const { page } = renderApp('/vocabulary/recognition');
    await until(() => page.getByRole('button', { name: 'Reveal Answer' }));
    observer.disconnect();
    expect(shown[0]).toBe('card');
  });
});

describe('going back to the previous word', () => {
  test('shows it answered, and Continue returns to the current word', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    expect(page.queryByRole('button', { name: 'Previous Card' })).not.toBeInTheDocument();
    session.reveal();
    await session.rate('Hard');

    session.goBack();
    expect(page.getByRole('heading', { name: 'kot' })).toBeInTheDocument();
    expect(page.getByRole('heading', { name: 'cat' })).toBeInTheDocument();
    expect(page.queryByRole('button', { name: 'Reveal Answer' })).not.toBeInTheDocument();

    await session.continue();
    expect(shownWord(page)).toEqual(['pies']);
    expect(page.queryByRole('heading', { name: 'dog' })).not.toBeInTheDocument();
  });

  test('reassessing replaces the earlier rating with the new one', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Hard');
    await settle();
    expect(storedCard(PL_EN, 1)?.state).toBe(State.Learning);

    session.goBack();
    // The buttons show intervals for the word as it was before the first rating.
    expect(session.intervals()).toEqual({ Again: '1m', Hard: '6m', Good: '10m', Easy: '8d' });
    await session.rate('Easy');

    expect(shownWord(page)).toEqual(['pies']);
    await settle();
    const saved = storedCard(PL_EN, 1);
    expect(saved?.state).toBe(State.Review);
    expect(saved?.reps).toBe(1);
  });

  test('reassessing as Again brings the word back later in the session', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');
    session.goBack();
    await session.rate('Again');

    expect(shownWord(page)).toEqual(['pies']);
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');
    session.reveal();
    await session.rate('Good');
    expect(shownWord(page)).toEqual(['kot']);

    await settle();
    expect(storedDoc('vocabularyReviewSession-pl-en')?.reviewedToday).toEqual([2]);
  });
});

describe('when the session is finished', () => {
  test('a recap shows how the session went', async () => {
    seed.vocabulary(kot, pies, dom, woda);
    newCardsPerDay('pl-en', 4);
    newCardsPerDay('en-pl', 4);

    const { page, session, finished } = await openDeck();
    for (const rating of ['Good', 'Easy', 'Hard', 'Again', 'Good'] as const) {
      session.reveal();
      await session.rate(rating);
    }

    expect(finished.recap()).toEqual([
      '5 reviews',
      '80% recall',
      'Easy 1',
      'Good 2',
      'Hard 1',
      'Again 1',
    ]);
    expect(page.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  test('Learn new starts extra new words beyond the daily limit', async () => {
    seed.vocabulary(kot, pies, dom, woda, okno);
    newCardsPerDay('pl-en', 1);

    const { page, session, finished } = await openDeck();
    session.reveal();
    await session.rate('Good');

    const learnNew = finished.learnNew();
    expect(learnNew.count).toHaveValue('5');
    click(learnNew.decrease);
    click(learnNew.decrease);
    expect(finished.learnNew().count).toHaveValue('3');
    click(finished.learnNew().start);

    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');
    expect(shownWord(page)).toEqual(['pies']);
    session.reveal();
    await session.rate('Good');
    await settle();
    expect(storedDoc('vocabularyReviewSession-pl-en')?.newCardsToday).toEqual([1, 2]);
  });

  test('the extra-word count accepts typed numbers and never drops below one', async () => {
    seed.vocabulary(kot, pies);
    newCardsPerDay('pl-en', 1);

    const { session, finished } = await openDeck();
    session.reveal();
    await session.rate('Good');

    const { count } = finished.learnNew();
    fireEvent.change(count, { target: { value: '12' } });
    expect(finished.learnNew().count).toHaveValue('12');
    fireEvent.change(count, { target: { value: 'abc' } });
    expect(finished.learnNew().count).toHaveValue('12');
    fireEvent.change(count, { target: { value: '' } });
    fireEvent.blur(count);
    expect(finished.learnNew().count).toHaveValue('1');
    expect(finished.learnNew().decrease).toBeDisabled();
  });

  test('Review early drills words that are not due yet, and saves those reviews', async () => {
    seed.vocabulary(kot, pies, dom);
    const piesProgress = reviewCardDueIn(3);
    seed.progress(PL_EN, 2, 'wordId', piesProgress);
    seed.progress(PL_EN, 3, 'wordId', reviewCardDueIn(9));
    newCardsPerDay('pl-en', 1);

    const { page, session, finished } = await openDeck();
    session.reveal();
    await session.rate('Good');

    click(finished.reviewEarly().start);
    expect(session.status()).toBe('Drill Ahead · 2 remaining');
    expect(shownWord(page)).toEqual(['pies']);

    session.reveal();
    await session.rate('Good');
    expect(shownWord(page)).toEqual(['dom']);
    await settle();
    expect(storedCard(PL_EN, 2)?.due.getTime()).toBeGreaterThan(piesProgress.due.getTime());
  });

  test('offers the other direction when it has words due, and switches to it', async () => {
    seed.vocabulary(kot, pies);
    newCardsPerDay('pl-en', 1);
    newCardsPerDay('en-pl', 2);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');

    expect(page.getByRole('heading', { name: "What's next?" })).toBeInTheDocument();
    const switchButton = page.getByRole('button', { name: /Switch to Production/ });
    expect(switchButton).toHaveTextContent('Switch to Production2');

    click(switchButton);
    expect(currentPath()).toBe('/vocabulary/production');
    expect(await until(() => page.getByRole('heading', { name: 'cat' }))).toBeInTheDocument();
  });

  test('the learn-new and review-early controls are labelled', async () => {
    seed.vocabulary(kot, pies);
    newCardsPerDay('pl-en', 1);

    const { session, finished } = await openDeck();
    session.reveal();
    await session.rate('Good');
    for (const row of [finished.learnNew(), finished.reviewEarly()]) {
      for (const control of [row.decrease, row.increase, row.start, row.count]) {
        expect(control).toHaveAccessibleName();
      }
    }
  });

  test('says all done when nothing else is due anywhere', async () => {
    seed.vocabulary(kot);
    newCardsPerDay('en-pl', 0);

    const { page, session } = await openDeck();
    session.reveal();
    await session.rate('Good');

    expect(page.getByRole('heading', { name: 'All done!' })).toBeInTheDocument();
    expect(page.getByText('Come back tomorrow for more drills')).toBeInTheDocument();
    expect(page.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });
});

describe('vocabulary settings', () => {
  test('changing new words per day rebuilds the session and is saved', async () => {
    seed.vocabulary(kot, pies, dom, woda);
    newCardsPerDay('pl-en', 2);

    const { page, session } = await openDeck();
    session.openSettings();
    expect(page.getByRole('spinbutton')).toHaveValue(2);

    session.setNewCardsPerDay('3');
    expect(await until(() => page.getByText(/3 new/))).toBeInTheDocument();
    expect(session.status()).toBe('0 reviews · 3 new · 3 remaining');
    await settle();
    expect(storedDoc('vocabularySettings-pl-en')).toEqual({ newCardsPerDay: 3 });
    expect(storedDoc('vocabularySettings-en-pl')).toBeUndefined();
  });

  test('new words per day cannot go below one', async () => {
    seed.vocabulary(kot, pies);

    const { page, session } = await openDeck();
    session.openSettings();
    session.setNewCardsPerDay('0');

    expect(page.getByRole('spinbutton')).toHaveValue(1);
    expect(await until(() => page.getByText(/1 new/))).toBeInTheDocument();
    await settle();
    expect(storedDoc('vocabularySettings-pl-en')).toEqual({ newCardsPerDay: 1 });
  });

  test('resetting progress erases this direction only and starts over', async () => {
    seed.vocabulary(kot, pies);
    seed.progress(PL_EN, 1, 'wordId', reviewCardDueIn(-1));
    seed.progress(EN_PL, 1, 'wordId', reviewCardDueIn(-1));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { page, session } = await openDeck();
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    session.openSettings();
    click(page.getByRole('button', { name: 'Reset PL→EN Progress' }));

    expect(await until(() => page.getByText(/0 reviews · 2 new/))).toBeInTheDocument();
    expect(page.queryByRole('spinbutton')).not.toBeInTheDocument();
    await settle();
    expect(storedIds(PL_EN)).toEqual([]);
    expect(storedIds(EN_PL)).toEqual(['1']);
  });

  test('declining the reset confirmation keeps all progress', async () => {
    seed.vocabulary(kot);
    seed.progress(PL_EN, 1, 'wordId', reviewCardDueIn(-1));
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { page, session } = await openDeck();
    session.openSettings();
    click(page.getByRole('button', { name: 'Reset PL→EN Progress' }));
    await settle();

    expect(storedIds(PL_EN)).toEqual(['1']);
    expect(session.status()).toBe('1 reviews · 0 new · 1 remaining');
  });
});

describe('audio', () => {
  test('does not play by default', async () => {
    seed.vocabulary(kot);
    const { session } = await openDeck();
    session.reveal();
    await session.rate('Good');
    expect(browser.played).toEqual([]);
    expect(browser.chimeNotes).toBe(0);
  });

  test('with auto-play on, recognition plays each word as it appears and rating chimes', async () => {
    seed.vocabulary(kot, pies);
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });

    const { session } = await openDeck();
    expect(browser.played).toEqual([kot.audioUrl]);

    session.reveal();
    await session.rate('Good');
    expect(browser.chimeNotes).toBeGreaterThan(0);
    expect(browser.played).toEqual([kot.audioUrl, pies.audioUrl]);
  });

  test('with auto-play on, production plays the word only once the answer is revealed', async () => {
    seed.vocabulary(kot);
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });

    const { session } = await openDeck('/vocabulary/production');
    await settle();
    expect(browser.played).toEqual([]);
    session.reveal();
    await settle();
    expect(browser.played).toEqual([kot.audioUrl]);
  });

  test('the play button replays the word, and the mute button turns auto-play off and saves it', async () => {
    seed.vocabulary(kot, pies);
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });

    const { page, session } = await openDeck();
    // Auto-play started it; the button stops it and plays it again.
    click(page.getByRole('button', { name: 'Stop audio' }));
    expect(page.getByRole('button', { name: 'Play audio' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    click(page.getByRole('button', { name: 'Play audio' }));
    expect(browser.played).toEqual([kot.audioUrl, kot.audioUrl]);

    click(page.getByRole('button', { name: 'Mute auto-play audio and chimes' }));
    expect(page.getByRole('button', { name: 'Enable auto-play audio and chimes' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    session.reveal();
    await session.rate('Good');
    await settle();

    expect(browser.played).toEqual([kot.audioUrl, kot.audioUrl]);
    expect(browser.chimeNotes).toBe(0);
    expect(storedDoc('appSettings')).toMatchObject({ autoPlayAudio: false });
  });
});

describe('audio-only mode', () => {
  test('hides the Polish word until the answer is revealed', async () => {
    seed.vocabulary(kot);
    seed.userDoc('appSettings', { autoPlayAudio: false, hidePolishText: true });

    const { page, session } = await openDeck();
    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
    expect(page.queryByText('kot')).not.toBeInTheDocument();

    session.reveal();
    expect(page.getByRole('heading', { name: 'kot' })).toBeInTheDocument();
    expect(page.getByRole('heading', { name: 'cat' })).toBeInTheDocument();
    expect(page.queryByText('Listen to the audio')).not.toBeInTheDocument();
  });

  test('in production it keeps the English prompt, and shows the Polish once revealed', async () => {
    seed.vocabulary(kot);
    seed.userDoc('appSettings', { autoPlayAudio: false, hidePolishText: true });

    const { page, session } = await openDeck('/vocabulary/production');
    expect(page.getByRole('heading', { name: 'cat' })).toBeInTheDocument();
    session.reveal();
    expect(page.getByRole('heading', { name: 'kot' })).toBeInTheDocument();
  });

  test('can be switched on from the card, and the choice is saved', async () => {
    seed.vocabulary(kot);

    const { page } = await openDeck();
    click(page.getByRole('button', { name: 'Hide Polish text' }));

    expect(page.getByText('Listen to the audio')).toBeInTheDocument();
    expect(page.getByRole('button', { name: 'Show Polish text' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await settle();
    expect(storedDoc('appSettings')).toMatchObject({ hidePolishText: true });
  });
});

describe('drill mode', () => {
  test('cycles through every word without touching progress, then returns to the session', async () => {
    seed.vocabulary(kot, pies, dom);
    const piesProgress = reviewCardDueIn(-1);
    seed.progress(PL_EN, 2, 'wordId', piesProgress);
    newCardsPerDay('pl-en', 1);

    const { page, session } = await openDeck();
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    expect(shownWord(page)).toEqual(['pies']);

    session.toggleDrill();
    expect(session.status()).toBe('Drill Mode · 3 words');
    expect(page.getByRole('button', { name: '✓ Drill' })).toBeInTheDocument();

    const drilled: Array<string | null> = [];
    for (let i = 0; i < 4; i++) {
      drilled.push(shownWord(page)[0]);
      session.reveal();
      expect(session.hasRatingButtons()).toBe(false);
      await session.nextDrillCard();
    }
    expect(drilled).toEqual(['kot', 'pies', 'dom', 'kot']);

    session.toggleDrill();
    expect(session.status()).toBe('1 reviews · 1 new · 2 remaining');
    expect(shownWord(page)).toEqual(['pies']);

    await settle();
    expect(storedIds(PL_EN)).toEqual(['2']);
    expect(storedCard(PL_EN, 2)?.due).toEqual(piesProgress.due);
    expect(storedDoc('vocabularyReviewSession-pl-en')).toBeUndefined();
  });

  test('hides the settings panel while drilling', async () => {
    seed.vocabulary(kot);
    const { page, session } = await openDeck();
    session.openSettings();
    expect(page.getByText('New cards per day')).toBeInTheDocument();

    session.toggleDrill();
    expect(page.queryByText('New cards per day')).not.toBeInTheDocument();
  });
});

describe('words with example sentences', () => {
  test('the examples can be expanded, and their translations appear with the answer', async () => {
    seed.vocabulary(
      word(1, 'kot', 'cat', { examples: [{ polish: 'Mam kota.', english: 'I have a cat.' }] })
    );

    const { page, session } = await openDeck();
    const toggle = page.getByRole('button', { name: 'Example sentences' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const examples = page.getByRole('region', { name: 'Example sentences' });
    expect(examples).toHaveTextContent('Mam kota.');
    expect(examples).not.toHaveTextContent('I have a cat.');

    session.reveal();
    expect(page.getByRole('region', { name: 'Example sentences' })).toHaveTextContent(
      'I have a cat.'
    );
  });

  test('production lists the examples in English first', async () => {
    seed.vocabulary(
      word(1, 'kot', 'cat', { examples: [{ polish: 'Mam kota.', english: 'I have a cat.' }] })
    );

    const { page, session } = await openDeck('/vocabulary/production');
    click(page.getByRole('button', { name: 'Example sentences' }));
    const examples = () => page.getByRole('region', { name: 'Example sentences' });
    expect(examples()).toHaveTextContent('I have a cat.');
    expect(examples()).not.toHaveTextContent('Mam kota.');
    session.reveal();
    expect(examples()).toHaveTextContent('Mam kota.');
  });
});

describe('custom words in the deck', () => {
  const kawa = {
    id: 'custom-1',
    polish: 'kawa',
    english: 'coffee',
    isCustom: true,
    createdAt: 1,
  };

  test('a custom word is marked as such and can be deleted after confirming', async () => {
    await seed.customItem('customVocabulary', kawa);
    seed.vocabulary(kot);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { page, session } = await openDeck();
    expect(shownWord(page)).toEqual(['kawa']);
    expect(page.getByText('Custom')).toBeInTheDocument();
    expect(session.status()).toBe('0 reviews · 2 new · 2 remaining');

    click(page.getByRole('button', { name: 'delete' }));
    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this custom word?'
    );
    expect(shownWord(page)).toEqual(['kot']);
    expect(session.status()).toBe('0 reviews · 2 new · 1 remaining');
    await settle();
    expect(storedIds('customVocabulary')).toEqual([]);
  });

  test('declining the confirmation keeps the custom word', async () => {
    await seed.customItem('customVocabulary', kawa);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { page } = await openDeck();
    click(page.getByRole('button', { name: 'delete' }));
    await settle();
    expect(shownWord(page)).toEqual(['kawa']);
    expect(storedIds('customVocabulary')).toEqual(['custom-1']);
  });

  test('a learner cannot edit or delete built-in words', async () => {
    seed.vocabulary(kot);
    const { page } = await openDeck();
    expect(page.queryByRole('button', { name: 'edit' })).not.toBeInTheDocument();
    expect(page.queryByRole('button', { name: 'delete' })).not.toBeInTheDocument();
    expect(page.queryByRole('button', { name: 'Generate sentences' })).not.toBeInTheDocument();
  });
});

describe('directions', () => {
  test('production asks in English and keeps its own progress', async () => {
    seed.vocabulary(kot);
    seed.progress(PL_EN, 1, 'wordId', reviewCardDueIn(30));

    const { page, session } = await openDeck('/vocabulary/production');
    expect(shownWord(page)).toEqual(['cat']);
    expect(session.status()).toBe('0 reviews · 1 new · 1 remaining');

    session.reveal();
    expect(page.getByRole('heading', { name: 'kot' })).toBeInTheDocument();
    await session.rate('Good');
    await settle();

    expect(storedCard(EN_PL, 1)?.state).toBe(State.Learning);
    expect(storedCard(PL_EN, 1)?.state).toBe(State.Review);
  });

  test('the mode picker shows each direction’s due words and progress, and opens it', async () => {
    seed.vocabulary(kot, pies, dom);
    seed.progress(PL_EN, 1, 'wordId', reviewCardDueIn(-1));
    seed.progress(PL_EN, 2, 'wordId', reviewCardDueIn(4));
    newCardsPerDay('en-pl', 1);

    const { page } = renderApp('/vocabulary');
    const recognition = await until(() => page.getByRole('button', { name: /Recognition/ }));
    await settle();

    expect(page.getByRole('heading', { name: 'Choose Your Drill Mode' })).toBeInTheDocument();
    // Recognition: word 1 due, word 3 new (limit 10); words 1 and 2 learned.
    expect(deckStats(recognition)).toEqual({ due: 2, learned: 2, total: 3 });
    // Production: nothing learned, one new word allowed today.
    const production = page.getByRole('button', { name: /Production/ });
    expect(deckStats(production)).toEqual({ due: 1, learned: 0, total: 3 });

    click(production);
    expect(currentPath()).toBe('/vocabulary/production');
    expect(await until(() => page.getByRole('heading', { name: 'cat' }))).toBeInTheDocument();
  });

  test('due counts on the mode picker go down after a review', async () => {
    seed.vocabulary(kot, pies);

    const app = renderApp('/vocabulary/recognition', <Link to="/vocabulary">Back</Link>);
    await until(() => app.page.getByRole('button', { name: 'Reveal Answer' }));
    await settle();
    const session = reviewSession(app.page);
    session.reveal();
    await session.rate('Good');

    click(app.page.getByRole('link', { name: 'Back' }));
    const recognition = await until(() => app.page.getByRole('button', { name: /Recognition/ }));
    expect(deckStats(recognition)).toEqual({ due: 1, learned: 1, total: 2 });
  });
});

describe('listening mode', () => {
  test('starts the listening player with the deck’s words that have audio', async () => {
    const { audioUrl: _a, ...silentDom } = dom;
    void _a;
    seed.vocabulary(kot, pies, silentDom);
    const { page } = await openDeck();

    click(page.getByRole('button', { name: 'Start listening mode' }));
    expect(currentPath()).toBe('/listen/play');
    const queue = screen.getByRole('list', { name: 'Listening queue' });
    expect(
      within(queue)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['kot', 'pies']);
  });

  test('explains when no word has audio', async () => {
    const { audioUrl: _a, ...silentKot } = kot;
    void _a;
    seed.vocabulary(silentKot);
    const { page } = await openDeck();

    click(page.getByRole('button', { name: 'Start listening mode' }));
    expect(await until(() => screen.getByRole('alert'))).toHaveTextContent(
      'No vocabulary with audio available.'
    );
    expect(currentPath()).toBe('/vocabulary/recognition');
  });
});

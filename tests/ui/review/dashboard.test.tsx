import { useState } from 'react';
import { Link } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { click, currentPath, elapse, renderApp, settle, setupReviewUi, until } from './support/app';
import {
  declensionCard,
  learningCardDueIn,
  reviewCardDueIn,
  seed,
  storedDoc,
  word,
} from './support/content';
import { deckStats, reviewSession } from './support/session';
import { CustomizeDashboardDialog } from '../../../src/components/CustomizeDashboardDialog';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

const DEFAULT_ORDER = [
  'Vocabulary',
  'Declension',
  'Conjugation',
  'Sentences',
  'Aspect Pairs',
  'Consonant Driller',
  'Library',
  'Audio',
  'Listening',
];

/** The entry point the settings page offers for the customize dialog. */
function CustomizeEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Customize</button>
      <CustomizeDashboardDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

async function openDashboard() {
  const app = renderApp('/dashboard', <CustomizeEntry />);
  await until(() => app.page.getByRole('button', { name: /Vocabulary/ }));
  await settle();
  const featureCard = (title: string) =>
    app.page.getByRole('button', { name: new RegExp(`^(\\d+ )?${title}`) });
  const order = () =>
    app.page
      .getAllByRole('heading', { level: 6 })
      .map((heading) => heading.textContent)
      .filter((title) => title !== null);
  return { ...app, featureCard, order };
}

/** dnd-kit measures rows on screen; lay the dialog's rows out in a column. */
function layOutDialogRows() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const row = this.closest('[data-qa^="customize-dashboard-item-"]');
    const index = row ? [...(row.parentElement?.children ?? [])].indexOf(row) : 0;
    const top = row ? 100 + index * 60 : 0;
    const height = row ? 50 : 0;
    const width = row ? 400 : 0;
    return {
      x: 0,
      y: top,
      top,
      left: 0,
      bottom: top + height,
      right: width,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

describe('dashboard', () => {
  test('each study feature shows its due count and progress', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'), word(2, 'pies', 'dog'), word(3, 'dom', 'house'));
    seed.userDoc('vocabularySettings-pl-en', { newCardsPerDay: 1 });
    seed.userDoc('vocabularySettings-en-pl', { newCardsPerDay: 1 });
    seed.progress('vocabularyReviewCards-pl-en', 3, 'wordId', reviewCardDueIn(-1));
    seed.declensionCards(declensionCard(1, 'Nie ma (kawa)', 'Nie ma kawy.', 'kawy'));
    seed.progress('declensionReviewCards', 1, 'cardId', reviewCardDueIn(4));

    const { featureCard } = await openDashboard();

    // Vocabulary: word 3 due in PL→EN, plus one new word allowed in each direction.
    expect(deckStats(featureCard('Vocabulary'))).toEqual({ due: 3, learned: 1, total: 3 });
    // Declension: the only card is learned and not due: complete for today.
    expect(deckStats(featureCard('Declension'))).toEqual({ due: 0, learned: 1, total: 1 });
    expect(within(featureCard('Declension')).getByTestId('CheckIcon')).toBeInTheDocument();
    expect(deckStats(featureCard('Conjugation'))).toEqual({ due: 0, learned: 0, total: 0 });
    // Extra tools have a description but no study stats.
    expect(featureCard('Consonant Driller')).toHaveTextContent(
      'Drill hard and soft Polish consonants'
    );
    expect(featureCard('Consonant Driller')).not.toHaveTextContent('Learned');
  });

  test('a learning card that comes due later today is not counted yet', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'));
    seed.userDoc('vocabularySettings-pl-en', { newCardsPerDay: 0 });
    seed.userDoc('vocabularySettings-en-pl', { newCardsPerDay: 0 });
    seed.progress('vocabularyReviewCards-pl-en', 1, 'wordId', learningCardDueIn(30));
    seed.userDoc('vocabularyReviewSession-pl-en', {
      reviewedToday: [1],
      newCardsToday: [1],
      lastReviewDate: '2026-03-10',
    });

    const { featureCard } = await openDashboard();
    expect(deckStats(featureCard('Vocabulary'))).toEqual({ due: 0, learned: 1, total: 1 });
  });

  test('choosing a feature opens it', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'));
    const { page, featureCard } = await openDashboard();

    click(featureCard('Vocabulary'));
    expect(currentPath()).toBe('/vocabulary');
    expect(
      await until(() => page.getByRole('heading', { name: 'Choose Your Drill Mode' }))
    ).toBeVisible();
  });

  test('studying a word from the dashboard lowers its due count there', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'), word(2, 'pies', 'dog'));
    seed.userDoc('vocabularySettings-en-pl', { newCardsPerDay: 0 });
    const { page } = renderApp('/dashboard', <Link to="/dashboard">Home</Link>);
    const vocabulary = () => page.getByRole('button', { name: /^(\d+ )?Vocabulary/ });
    await until(vocabulary);
    await settle();
    expect(deckStats(vocabulary())).toEqual({ due: 2, learned: 0, total: 2 });

    click(vocabulary());
    click(await until(() => page.getByRole('button', { name: /Recognition/ })));
    await until(() => page.getByRole('button', { name: 'Reveal Answer' }));
    const session = reviewSession(page);
    session.reveal();
    await session.rate('Good');

    click(page.getByRole('link', { name: 'Home' }));
    expect(deckStats(await until(vocabulary))).toEqual({ due: 1, learned: 1, total: 2 });
  });

  test('on a phone it lists features as compact rows with the same numbers', async () => {
    window.innerWidth = 390;
    seed.vocabulary(word(1, 'kot', 'cat'), word(2, 'pies', 'dog'));
    seed.progress('vocabularyReviewCards-pl-en', 1, 'wordId', reviewCardDueIn(3));

    const { page } = await openDashboard();
    const row = page.getByRole('button', { name: /Vocabulary/ });
    // Due: word 2 is new in both directions, word 1 in production; 1 of 2 learned.
    expect(row.textContent?.replace(/\s/g, '')).toBe('Vocabulary1/23');
    expect(page.queryByText('Learned')).not.toBeInTheDocument();
  });

  test('follows the order the learner saved', async () => {
    seed.userDoc('appSettings', {
      autoPlayAudio: false,
      hidePolishText: false,
      dashboardOrder: ['/consonant-driller', '/declension'],
    });

    const { order } = await openDashboard();
    expect(order()).toEqual([
      'Consonant Driller',
      'Declension',
      'Vocabulary',
      'Conjugation',
      'Sentences',
      'Aspect Pairs',
      'Library',
      'Audio',
      'Listening',
    ]);
  });
});

describe('customizing the dashboard order', () => {
  test('moving a feature in the dialog reorders the dashboard and saves the order', async () => {
    const { page, order } = await openDashboard();
    expect(order()).toEqual(DEFAULT_ORDER);

    click(page.getByRole('button', { name: 'Customize' }));
    const dialog = within(
      await until(() => screen.getByRole('dialog', { name: 'Customize Dashboard' }))
    );
    layOutDialogRows();

    // Keyboard drag: pick Vocabulary up, move it down two places, drop it.
    const handle = dialog.getByRole('button', { name: 'Reorder Vocabulary' });
    handle.focus();
    fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
    await elapse(50);
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' });
    await elapse(50);
    fireEvent.keyDown(document, { code: 'ArrowDown', key: 'ArrowDown' });
    await elapse(50);
    fireEvent.keyDown(document, { code: 'Space', key: ' ' });
    await elapse(50);

    click(dialog.getByRole('button', { name: 'Save' }));
    await elapse();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(order().slice(0, 4)).toEqual(['Declension', 'Conjugation', 'Vocabulary', 'Sentences']);

    await settle();
    expect(storedDoc('appSettings')?.dashboardOrder).toEqual([
      '/declension',
      '/conjugation',
      '/vocabulary',
      '/sentences',
      '/aspect-pairs',
      '/consonant-driller',
      '/library',
      '/audio',
      '/listen',
    ]);
  });

  test('Cancel closes the dialog without changing the order', async () => {
    const { page, order } = await openDashboard();
    click(page.getByRole('button', { name: 'Customize' }));
    const dialog = within(await until(() => screen.getByRole('dialog')));
    expect(dialog.getAllByRole('listitem')).toHaveLength(DEFAULT_ORDER.length);

    click(dialog.getByRole('button', { name: 'Cancel' }));
    await elapse();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(order()).toEqual(DEFAULT_ORDER);
    await settle();
    expect(storedDoc('appSettings')).toBeUndefined();
  });

  test('Reset to default puts the features back in their original order', async () => {
    seed.userDoc('appSettings', {
      autoPlayAudio: false,
      hidePolishText: false,
      dashboardOrder: ['/listen', '/audio'],
    });
    const { page, order } = await openDashboard();
    expect(order().slice(0, 2)).toEqual(['Listening', 'Audio']);

    click(page.getByRole('button', { name: 'Customize' }));
    const dialog = within(await until(() => screen.getByRole('dialog')));
    click(dialog.getByRole('button', { name: 'Reset to default' }));
    await elapse();

    expect(order()).toEqual(DEFAULT_ORDER);
  });

  test('Reset to default is saved to the server without an error', async () => {
    seed.userDoc('appSettings', {
      autoPlayAudio: false,
      hidePolishText: false,
      dashboardOrder: ['/listen', '/audio'],
    });
    const { page } = await openDashboard();

    click(page.getByRole('button', { name: 'Customize' }));
    const dialog = within(await until(() => screen.getByRole('dialog')));
    click(dialog.getByRole('button', { name: 'Reset to default' }));
    await settle();
    await elapse();

    expect(storedDoc('appSettings')?.dashboardOrder).toBeUndefined();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

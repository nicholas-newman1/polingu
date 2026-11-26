import { describe, expect, test, vi } from 'vitest';
import { click, elapse, renderApp, settle, setupReviewUi, until } from './support/app';
import { seed } from './support/content';
import { browser } from './support/browser';
import { CONSONANT_PAIRS, CONSONANT_WORDS } from '../../../src/data/consonants';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

// One card per hard consonant and one per soft consonant, in data order (shuffle is mocked).
const CONSONANT_CARDS = CONSONANT_PAIRS.flatMap((pair) =>
  pair.hasHard ? [pair.hard, pair.soft] : [pair.soft]
);

async function openDriller() {
  const app = renderApp('/consonant-driller');
  await until(() => app.page.getByRole('button', { name: 'Hard' }));
  const { page } = app;
  return {
    ...app,
    progress: () => page.getByText(/^\d+ \/ \d+$|^Completed all/).textContent,
    answer: (choice: 'Hard' | 'Soft') => click(page.getByRole('button', { name: choice })),
    next: async () => {
      click(page.getByRole('button', { name: 'Next →' }));
      await elapse();
    },
  };
}

describe('consonant driller', () => {
  test('tells the learner whether they were right and shows the hard/soft pair', async () => {
    const { page, progress, answer, next } = await openDriller();
    expect(progress()).toBe(`1 / ${CONSONANT_CARDS.length}`);
    expect(page.getByText('m', { selector: 'p' })).toBeInTheDocument();
    expect(page.getByRole('progressbar', { name: 'Session progress' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );

    answer('Soft');
    expect(page.getByText("Wrong — it's Hard")).toBeInTheDocument();
    expect(page.getByText('Consonant pair:')).toBeInTheDocument();
    expect(page.getByText('mi')).toBeInTheDocument();
    expect(page.getByText('Example words:')).toBeInTheDocument();
    expect(page.queryByRole('button', { name: 'Hard' })).not.toBeInTheDocument();

    await next();
    expect(progress()).toBe(`2 / ${CONSONANT_CARDS.length}`);
    expect(page.getByText('mi', { selector: 'p' })).toBeInTheDocument();
    answer('Soft');
    expect(page.getByText('Correct!')).toBeInTheDocument();
  });

  test('word mode drills whole words, with their meaning and gender', async () => {
    const { page, progress, answer } = await openDriller();
    click(page.getByRole('button', { name: 'Word' }));

    const first = CONSONANT_WORDS[0];
    expect(progress()).toBe(`1 / ${CONSONANT_WORDS.length}`);
    expect(page.getByText(first.word)).toBeInTheDocument();
    expect(page.getByText(first.translation)).toBeInTheDocument();
    expect(page.getByText(first.gender)).toBeInTheDocument();

    answer(first.consonantType === 'hard' ? 'Hard' : 'Soft');
    expect(page.getByText('Correct!')).toBeInTheDocument();
    expect(
      page.getByText(`The consonant "${first.consonant}" is ${first.consonantType}`)
    ).toBeInTheDocument();
  });

  test('moving on is silent by default', async () => {
    const { answer, next } = await openDriller();
    answer('Hard');
    await next();
    expect(browser.chimeNotes).toBe(0);
  });

  test('moving on chimes when sounds are on', async () => {
    seed.userDoc('appSettings', { autoPlayAudio: true, hidePolishText: false });
    const { answer, next } = await openDriller();
    await settle();
    answer('Hard');
    await next();
    expect(browser.chimeNotes).toBeGreaterThan(0);
  });

  test('after the last card it congratulates the learner, and Drill Again starts over', async () => {
    const { page, progress, answer, next } = await openDriller();
    for (let i = 0; i < CONSONANT_CARDS.length; i++) {
      answer('Hard');
      await next();
    }

    expect(page.getByText('🎉 Session Complete!')).toBeInTheDocument();
    expect(
      page.getByText(`You've gone through all ${CONSONANT_CARDS.length} consonants.`)
    ).toBeInTheDocument();
    expect(progress()).toBe(`Completed all ${CONSONANT_CARDS.length} cards`);

    click(page.getByRole('button', { name: 'Drill Again' }));
    expect(progress()).toBe(`1 / ${CONSONANT_CARDS.length}`);
  });

  test('Restart goes back to the first card mid-session', async () => {
    const { page, progress, answer, next } = await openDriller();
    answer('Hard');
    await next();
    answer('Hard');
    await next();
    expect(progress()).toBe(`3 / ${CONSONANT_CARDS.length}`);

    click(page.getByRole('button', { name: 'Restart' }));
    expect(progress()).toBe(`1 / ${CONSONANT_CARDS.length}`);
  });
});

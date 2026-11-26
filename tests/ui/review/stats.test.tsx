import { describe, expect, test, vi } from 'vitest';
import { within } from '@testing-library/react';
import { renderApp, settle, setupReviewUi, until } from './support/app';
import { declensionCard, learningCardDueIn, reviewCardDueIn, seed, word } from './support/content';

vi.mock('firebase/firestore', () => import('../../sync/support/fakeFirestore'));
vi.mock('firebase/auth', () => import('./support/fakeAuth'));
vi.mock('firebase/functions', () => import('./support/fakeCloud'));
vi.mock('firebase/storage', () => import('./support/fakeCloud'));
vi.mock('../../../src/lib/utils/shuffleArray', () => import('./support/inOrder'));

setupReviewUi();

async function openStats() {
  const app = renderApp('/stats');
  await until(() => app.page.getByRole('heading', { name: 'Study Statistics' }));
  await settle();
  /** The figures in one section, e.g. { Studied: 2, Mastered: 1, Total: 4 }. */
  const section = (title: 'Vocabulary' | 'Declension') => {
    const box = app.page.getByRole('heading', { name: title }).parentElement?.parentElement;
    if (!box) throw new Error(`No ${title} section`);
    const figure = (label: string) =>
      Number(within(box).getByText(label).parentElement?.firstChild?.textContent);
    return {
      Studied: figure('Studied'),
      Mastered: figure('Mastered'),
      Total: figure('Total'),
      breakdown: within(box).queryByText(/system/)?.textContent,
    };
  };
  return { ...app, section };
}

describe('statistics', () => {
  test('counts words studied in either direction, and mastered only when mastered in both', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'), word(2, 'pies', 'dog'), word(3, 'dom', 'house'));
    await seed.customItem('customVocabulary', {
      id: 'custom-1',
      polish: 'kawa',
      english: 'coffee',
      isCustom: true,
      createdAt: 1,
    });
    seed.progress('vocabularyReviewCards-pl-en', 1, 'wordId', reviewCardDueIn(5));
    seed.progress('vocabularyReviewCards-en-pl', 1, 'wordId', reviewCardDueIn(-1));
    seed.progress('vocabularyReviewCards-pl-en', 2, 'wordId', reviewCardDueIn(2));
    seed.progress('vocabularyReviewCards-en-pl', 'custom-1', 'wordId', learningCardDueIn(5));

    const { section } = await openStats();
    expect(section('Vocabulary')).toEqual({
      Studied: 3,
      Mastered: 1,
      Total: 4,
      breakdown: '3 system + 1 custom',
    });
  });

  test('counts declension cards studied and mastered', async () => {
    seed.declensionCards(
      declensionCard(1, 'Nie ma (kawa)', 'Nie ma kawy.', 'kawy'),
      declensionCard(2, 'Idę do (sklep)', 'Idę do sklepu.', 'sklepu'),
      declensionCard(3, 'Daję (pies)', 'Daję psu.', 'psu')
    );
    seed.progress('declensionReviewCards', 1, 'cardId', reviewCardDueIn(-3));
    seed.progress('declensionReviewCards', 2, 'cardId', learningCardDueIn(1));

    const { section } = await openStats();
    expect(section('Declension')).toEqual({
      Studied: 2,
      Mastered: 1,
      Total: 3,
      breakdown: '3 system',
    });
  });

  test('a learner with no progress sees zeros against the full totals', async () => {
    seed.vocabulary(word(1, 'kot', 'cat'));

    const { section } = await openStats();
    expect(section('Vocabulary')).toMatchObject({ Studied: 0, Mastered: 0, Total: 1 });
    expect(section('Declension')).toMatchObject({ Studied: 0, Mastered: 0, Total: 0 });
  });
});

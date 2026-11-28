import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReprioritizeVocabularyWord } from '../../src/hooks/useReprioritizeVocabularyWord';
import type { SnackbarOptions } from '../../src/contexts/SnackbarContext';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { emptyStore, entry, type Store, type Stores } from './support/reviewSession';
import { withSnackbar } from './support/providers';
import { renderWithReviewData, type ReviewDataSeed } from './support/reviewDataProviders';
import { saveReviewStore, vocabularyStorage } from '../../src/lib/storage/reviewDeckStorage';
import type { TranslationDirection } from '../../src/types/common';

// The providers' live custom-collection listeners are the Firestore boundary.
vi.mock('../../src/lib/storage/customVocabulary', () => ({
  loadCustomVocabulary: vi.fn(),
  subscribeCustomVocabulary: vi.fn(),
}));
vi.mock('../../src/lib/storage/customDeclension', () => ({
  loadCustomDeclension: vi.fn(),
  subscribeCustomDeclension: vi.fn(),
}));
vi.mock('../../src/lib/storage/customSentences', () => ({
  loadCustomSentences: vi.fn(),
  subscribeCustomSentences: vi.fn(),
}));
// Saving the review store is the storage boundary; the provider updates its state first.
vi.mock('../../src/lib/storage/reviewDeckStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/storage/reviewDeckStorage')>()),
  saveReviewStore: vi.fn(),
}));

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];
const QUEUED = 'Word queued for review again.';
const DUPLICATE = 'This Polish word is already in your custom vocabulary.';
const BUILT_IN_DUPLICATE = 'This Polish word is already in the built-in deck.';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
});

/** A store where each of `ids` was studied (and reviewed earlier today). */
const studiedStore = (...ids: string[]): Store =>
  emptyStore({
    cards: Object.fromEntries(ids.map((id) => entry(id, fsrsCard(State.Review, inDays(20))))),
    reviewedToday: ids,
  });

/** Renders the hook inside the real vocabulary review data, plus a snackbar. */
function renderReprioritize(vocabularyStores: Stores, seed: ReviewDataSeed = {}) {
  const snackbar = withSnackbar();
  const h = renderWithReviewData(
    useReprioritizeVocabularyWord,
    { ...seed, vocabularyStores },
    { wrapper: snackbar.wrapper }
  );
  /** The action offered by the last snackbar shown. */
  const action = () =>
    (snackbar.showSnackbar.mock.calls.at(-1)?.[2] as SnackbarOptions | undefined)?.action;
  /** Each store saved, with its direction. */
  const saved = () =>
    vi.mocked(saveReviewStore).mock.calls.map(([storage, , store]) => ({
      direction: DIRECTIONS.find((d) => vocabularyStorage[d] === storage),
      store: store as Store,
    }));
  return { ...h, showSnackbar: snackbar.showSnackbar, action, saved };
}

describe('useReprioritizeVocabularyWord', () => {
  test('review again resets the word in every direction it was studied in, and confirms', () => {
    const h = renderReprioritize({
      'pl-to-en': studiedStore('kot', 'pies'),
      'en-to-pl': studiedStore('kot'),
    });
    expect(h.result.current.canReprioritize('kot')).toBe(true);

    act(() => h.result.current.reprioritize('kot'));

    expect(h.saved().map(({ direction }) => direction)).toEqual(['pl-to-en', 'en-to-pl']);
    for (const { store } of h.saved()) {
      expect(store.cards.kot.fsrsCard.state).toBe(State.New);
      expect(store.reviewedToday).not.toContain('kot');
    }
    expect(h.saved()[0].store.cards.pies.fsrsCard.state).toBe(State.Review);
    expect(h.showSnackbar).toHaveBeenCalledExactlyOnceWith(QUEUED, 'success');
    // The vocabulary data now holds the reset word, so there is nothing left to re-queue.
    expect(h.result.current.canReprioritize('kot')).toBe(false);
  });

  test('a duplicate custom word offers review again only when studied, and the action re-queues it', () => {
    const h = renderReprioritize({ 'pl-to-en': studiedStore('kot'), 'en-to-pl': emptyStore() });

    act(() => h.result.current.showDuplicateError('pies'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', undefined);

    act(() => h.result.current.showDuplicateError('kot'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', {
      action: { label: 'Review again', onClick: expect.any(Function) },
    });

    act(() => h.action()!.onClick());

    expect(h.saved()).toEqual([
      { direction: 'pl-to-en', store: expect.objectContaining({ reviewedToday: [] }) },
    ]);
    expect(h.showSnackbar).toHaveBeenLastCalledWith(QUEUED, 'success');
    expect(h.result.current.canReprioritize('kot')).toBe(false);
  });

  describe('reportDuplicatePolish', () => {
    const builtInDom = { id: 79, polish: 'dom', english: 'house' };
    const customKot = {
      id: 'custom_1',
      polish: 'kot',
      english: 'cat',
      isCustom: true as const,
      createdAt: 1,
    };

    test('reports a custom duplicate first, ignoring case and spacing', () => {
      const h = renderReprioritize(
        { 'pl-to-en': emptyStore(), 'en-to-pl': emptyStore() },
        { systemWords: [builtInDom] }
      );
      let reported = false;
      act(() => {
        reported = h.result.current.reportDuplicatePolish([customKot], ' KOT ');
      });
      expect(reported).toBe(true);
      expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', undefined);
    });

    test('refuses a built-in word, and its "Review again" re-queues the studied system word', () => {
      const h = renderReprioritize(
        { 'pl-to-en': studiedStore('79'), 'en-to-pl': emptyStore() },
        { systemWords: [builtInDom] }
      );
      let reported = false;
      act(() => {
        reported = h.result.current.reportDuplicatePolish([customKot], 'Dom');
      });
      expect(reported).toBe(true);
      expect(h.showSnackbar).toHaveBeenLastCalledWith(BUILT_IN_DUPLICATE, 'error', {
        action: { label: 'Review again', onClick: expect.any(Function) },
      });

      act(() => h.action()!.onClick());

      expect(h.saved()).toEqual([
        { direction: 'pl-to-en', store: expect.objectContaining({ reviewedToday: [] }) },
      ]);
      expect(h.saved()[0].store.cards['79'].fsrsCard.state).toBe(State.New);
      expect(h.showSnackbar).toHaveBeenLastCalledWith(QUEUED, 'success');
    });

    test('offers "Study next" for a built-in word never studied, which puts it first in both directions', async () => {
      const h = renderReprioritize(
        { 'pl-to-en': emptyStore(), 'en-to-pl': emptyStore() },
        { systemWords: [builtInDom] }
      );
      act(() => {
        h.result.current.reportDuplicatePolish([], 'dom');
      });
      expect(h.showSnackbar).toHaveBeenLastCalledWith(
        BUILT_IN_DUPLICATE,
        'error',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Study next' }) })
      );

      await act(async () => {
        h.action()!.onClick();
      });
      expect(h.showSnackbar).toHaveBeenLastCalledWith(
        'Word moved to the front of your new words.',
        'success'
      );
      const saved = h.saved();
      expect(saved.map((s) => s.direction).sort()).toEqual(['en-to-pl', 'pl-to-en']);
      for (const { store } of saved) {
        expect(store.cards[String(builtInDom.id)].prioritizedAt).toBe(Date.now());
      }
    });

    test('passes words that are in neither the custom nor the built-in deck', () => {
      const h = renderReprioritize(
        { 'pl-to-en': emptyStore(), 'en-to-pl': emptyStore() },
        { systemWords: [builtInDom] }
      );
      expect(h.result.current.reportDuplicatePolish([customKot], 'pies')).toBe(false);
      expect(h.showSnackbar).not.toHaveBeenCalled();
    });
  });

  test('throws a clear error outside ReviewDataProvider', () => {
    // React reports the error thrown by a hook used outside its provider; keep the log quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = withSnackbar();
    expect(() => renderHook(useReprioritizeVocabularyWord, { wrapper })).toThrow(
      'useVocabulary must be used within a ReviewDataProvider'
    );
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReprioritizeSentence } from '../../src/hooks/useReprioritizeSentence';
import type { SnackbarOptions } from '../../src/contexts/SnackbarContext';
import type { TranslationDirection } from '../../src/types/common';
import type { SentenceReviewDataStore } from '../../src/types/sentences';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { withSnackbar } from './support/providers';
import { renderWithReviewData } from './support/reviewDataProviders';
import { saveReviewStore, sentenceStorage } from '../../src/lib/storage/reviewDeckStorage';

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];

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

const QUEUED = 'Sentence queued for review again.';
const DUPLICATE = 'This sentence is already in your collection.';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
});

/** A store where each of `ids` was studied (and reviewed earlier today). */
const store = (...ids: string[]): SentenceReviewDataStore => ({
  cards: Object.fromEntries(
    ids.map((id) => [id, { sentenceId: id, fsrsCard: fsrsCard(State.Review, inDays(20)) }])
  ),
  reviewedToday: ids,
  newCardsToday: [],
  lastReviewDate: '2026-03-10',
});

/** Renders the hook inside the real sentence review data, plus a snackbar. */
function renderReprioritize(sentenceStores: Record<TranslationDirection, SentenceReviewDataStore>) {
  const snackbar = withSnackbar();
  const h = renderWithReviewData(
    useReprioritizeSentence,
    { sentenceStores },
    { wrapper: snackbar.wrapper }
  );
  /** The action offered by the last snackbar shown. */
  const action = () =>
    (snackbar.showSnackbar.mock.calls.at(-1)?.[2] as SnackbarOptions | undefined)?.action;
  /** Each store saved, with its direction. */
  const saved = () =>
    vi.mocked(saveReviewStore).mock.calls.map(([storage, , store]) => ({
      direction: DIRECTIONS.find((d) => sentenceStorage[d] === storage),
      store,
    }));
  return { ...h, showSnackbar: snackbar.showSnackbar, action, saved };
}

describe('useReprioritizeSentence', () => {
  test('review again resets the sentence where it was studied, and confirms', () => {
    const h = renderReprioritize({ 'pl-to-en': store(), 'en-to-pl': store('s1', 's2') });
    expect(h.result.current.canReprioritize('s1')).toBe(true);

    act(() => h.result.current.reprioritize('s1'));

    expect(h.saved()).toHaveLength(1);
    const [{ direction, store: savedStore }] = h.saved();
    expect(direction).toBe('en-to-pl');
    expect(savedStore.cards.s1.fsrsCard.state).toBe(State.New);
    expect(savedStore.cards.s2.fsrsCard.state).toBe(State.Review);
    expect(savedStore.reviewedToday).toEqual(['s2']);
    expect(h.showSnackbar).toHaveBeenCalledExactlyOnceWith(QUEUED, 'success');
    // The sentence data now holds the reset sentence, so there is nothing left to re-queue.
    expect(h.result.current.canReprioritize('s1')).toBe(false);
  });

  test('a duplicate sentence offers review again only when studied, and the action re-queues it', () => {
    const h = renderReprioritize({ 'pl-to-en': store('s1'), 'en-to-pl': store() });

    act(() => h.result.current.showDuplicateError('s2'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', undefined);

    act(() => h.result.current.showDuplicateError('s1'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', {
      action: { label: 'Review again', onClick: expect.any(Function) },
    });

    act(() => h.action()!.onClick());

    expect(h.saved()).toEqual([
      { direction: 'pl-to-en', store: expect.objectContaining({ reviewedToday: [] }) },
    ]);
    expect(h.showSnackbar).toHaveBeenLastCalledWith(QUEUED, 'success');
    expect(h.result.current.canReprioritize('s1')).toBe(false);
  });

  test('throws a clear error outside ReviewDataProvider', () => {
    // React reports the error thrown by a hook used outside its provider; keep the log quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = withSnackbar();
    expect(() => renderHook(useReprioritizeSentence, { wrapper })).toThrow(
      'useSentences must be used within a ReviewDataProvider'
    );
  });
});

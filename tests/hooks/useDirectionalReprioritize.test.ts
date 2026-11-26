import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDirectionalReprioritize } from '../../src/hooks/useDirectionalReprioritize';
import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
} from '../../src/lib/storage/reprioritizeVocabularyWord';
import type { SnackbarOptions } from '../../src/contexts/SnackbarContext';
import type { TranslationDirection } from '../../src/types/common';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { emptyStore, entry, type Stores } from './support/reviewSession';
import { withSnackbar } from './support/providers';

const QUEUED = 'Word queued for review again.';
const DUPLICATE = 'This Polish word is already in your custom vocabulary.';

const studied = () => fsrsCard(State.Review, inDays(20), { stability: 30, difficulty: 5, reps: 5 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T12:00:00'));
});

function renderReprioritize(initial: Stores) {
  const { wrapper, showSnackbar } = withSnackbar();
  const updateStore =
    vi.fn<(direction: TranslationDirection, store: Stores['pl-to-en']) => Promise<void>>();
  const hook = renderHook(
    ({ stores }) =>
      useDirectionalReprioritize({
        stores,
        updateStore,
        reprioritize: reprioritizeVocabularyWord,
        canReprioritize: canReprioritizeVocabularyWord,
        queuedMessage: QUEUED,
        duplicateMessage: DUPLICATE,
      }),
    { wrapper, initialProps: { stores: initial } }
  );
  const action = () => {
    const options = showSnackbar.mock.calls.at(-1)?.[2] as SnackbarOptions | undefined;
    return options?.action;
  };
  return { ...hook, updateStore, showSnackbar, action };
}

describe('useDirectionalReprioritize', () => {
  test('review again resets the word in each direction it was studied in, and confirms', () => {
    const h = renderReprioritize({
      'pl-to-en': emptyStore({
        cards: Object.fromEntries([entry('kot', studied()), entry('pies', studied())]),
        reviewedToday: ['kot', 'pies'],
      }),
      'en-to-pl': emptyStore(),
    });

    act(() => h.result.current.reprioritize('kot'));

    expect(h.updateStore).toHaveBeenCalledTimes(1);
    const [direction, store] = h.updateStore.mock.calls[0];
    expect(direction).toBe('pl-to-en');
    expect(store.cards.kot.fsrsCard.state).toBe(State.New);
    expect(store.cards.pies.fsrsCard.state).toBe(State.Review);
    expect(store.reviewedToday).toEqual(['pies']);
    expect(h.showSnackbar).toHaveBeenCalledExactlyOnceWith(QUEUED, 'success');
  });

  test('a word never studied is left alone, with no confirmation', () => {
    const h = renderReprioritize({ 'pl-to-en': emptyStore(), 'en-to-pl': emptyStore() });
    expect(h.result.current.canReprioritize('kot')).toBe(false);
    act(() => h.result.current.reprioritize('kot'));
    expect(h.updateStore).not.toHaveBeenCalled();
    expect(h.showSnackbar).not.toHaveBeenCalled();
  });

  test('the duplicate warning offers Review again only for a word already studied', () => {
    const h = renderReprioritize({
      'pl-to-en': emptyStore(),
      'en-to-pl': emptyStore({ cards: Object.fromEntries([entry('kot', studied())]) }),
    });

    act(() => h.result.current.showDuplicateError('pies'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', undefined);

    act(() => h.result.current.showDuplicateError('kot'));
    expect(h.showSnackbar).toHaveBeenLastCalledWith(DUPLICATE, 'error', {
      action: { label: 'Review again', onClick: expect.any(Function) },
    });
    act(() => h.action()?.onClick());
    expect(h.updateStore).toHaveBeenCalledExactlyOnceWith('en-to-pl', expect.anything());
  });

  // BUG: the snackbar's "Review again" action closes over the review stores from when the
  // warning was shown, and stays clickable for 8 s. Reviews saved in between (the learner
  // closes the add dialog and rates a card) are not in that snapshot, so clicking the
  // action writes the old store back over them. Expected: the stored update keeps the
  // later review of "pies". Actual: "pies" is back to its state before that review.
  test.fails('Review again from an older warning keeps reviews saved since it was shown', () => {
    const before = emptyStore({
      cards: Object.fromEntries([entry('kot', studied()), entry('pies', studied())]),
    });
    const h = renderReprioritize({ 'pl-to-en': before, 'en-to-pl': emptyStore() });
    act(() => h.result.current.showDuplicateError('kot'));

    const reviewedPies = { wordId: 'pies', fsrsCard: { ...studied(), reps: 6 } };
    h.rerender({
      stores: {
        'pl-to-en': {
          ...before,
          cards: { ...before.cards, pies: reviewedPies },
          reviewedToday: ['pies'],
        },
        'en-to-pl': emptyStore(),
      },
    });
    act(() => h.action()?.onClick());

    const [, store] = h.updateStore.mock.calls[0];
    expect(store.cards.kot.fsrsCard.state).toBe(State.New);
    expect(store.cards.pies.fsrsCard.reps).toBe(6);
    expect(store.reviewedToday).toEqual(['pies']);
  });
});

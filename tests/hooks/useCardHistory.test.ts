import { describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCardHistory } from '../../src/hooks/useCardHistory';

interface Card {
  id: string;
  text: string;
}

const card = (id: string): Card => ({ id, text: id });

function renderHistory(...ids: string[]) {
  const hook = renderHook(() => useCardHistory<Card, { before: string }>());
  for (const id of ids) {
    act(() => hook.result.current.addToHistory(card(id), { before: `${id}-before` }));
  }
  const history = () => hook.result.current;
  return {
    history,
    back: () => act(() => history().goBack()),
    forward: () => act(() => history().goForward()),
    shown: () => history().historyCard?.id ?? null,
  };
}

describe('useCardHistory', () => {
  test('starts empty, on the live card, with nowhere to go', () => {
    const { history, back, shown } = renderHistory();
    expect(history()).toMatchObject({
      isViewingHistory: false,
      canGoBack: false,
      canGoForward: false,
      historyCard: null,
      historyMeta: null,
    });
    back();
    expect(shown()).toBeNull();
  });

  test('going back walks from the newest card to the oldest and stops there', () => {
    const { history, back, shown } = renderHistory('A', 'B', 'C');
    back();
    expect(shown()).toBe('C');
    back();
    expect(shown()).toBe('B');
    back();
    expect(shown()).toBe('A');
    expect(history().canGoBack).toBe(false);
    back();
    expect(shown()).toBe('A');
  });

  test('going forward past the newest card returns to the live card', () => {
    const { history, back, forward, shown } = renderHistory('A', 'B');
    back();
    back();
    forward();
    expect(shown()).toBe('B');
    expect(history().canGoForward).toBe(true);
    forward();
    expect(history().isViewingHistory).toBe(false);
    expect(history().canGoForward).toBe(false);
    forward();
    expect(history().isViewingHistory).toBe(false);
  });

  test('each card shown from history comes with the data it was added with', () => {
    const { history, back } = renderHistory('A', 'B');
    back();
    expect(history().historyMeta).toEqual({ before: 'B-before' });
    back();
    expect(history().historyMeta).toEqual({ before: 'A-before' });
  });

  test('adding a card while looking back returns to the live card', () => {
    const { history, back } = renderHistory('A', 'B');
    back();
    back();
    act(() => history().addToHistory(card('C'), { before: 'C-before' }));

    expect(history().isViewingHistory).toBe(false);
    expect(history().history.map(({ id }) => id)).toEqual(['A', 'B', 'C']);
  });

  test('an edit applies only to matching cards and keeps their position', () => {
    const { history, back, shown } = renderHistory('A', 'B', 'A');
    back();
    act(() =>
      history().updateInHistory(
        ({ id }) => id === 'A',
        (c) => ({ ...c, text: 'edited' })
      )
    );
    expect(history().history.map(({ text }) => text)).toEqual(['edited', 'B', 'edited']);
    expect(shown()).toBe('A');
    expect(history().historyCard?.text).toBe('edited');
  });

  test('clearing forgets every card and leaves the history view', () => {
    const { history, back } = renderHistory('A', 'B');
    back();
    act(() => history().clearHistory());
    expect(history()).toMatchObject({
      history: [],
      isViewingHistory: false,
      canGoBack: false,
      historyMeta: null,
    });
  });
});

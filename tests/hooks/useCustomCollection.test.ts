import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCustomCollection } from '../../src/hooks/useCustomCollection';
import { withAuth } from './support/providers';

interface Item {
  id: string;
}

/**
 * A stand-in for a storage `subscribe` (e.g. subscribeCustomVocabulary): records each
 * subscription so the test can push snapshots into it and see whether it was closed.
 */
function fakeSubscription() {
  const subscriptions: Array<{ emit: (items: Item[]) => void; closed: boolean }> = [];
  const subscribe = vi.fn((onChange: (items: Item[]) => void) => {
    const subscription = { emit: (items: Item[]) => act(() => onChange(items)), closed: false };
    subscriptions.push(subscription);
    return () => {
      subscription.closed = true;
    };
  });
  return { subscribe, subscriptions };
}

function renderCollection(uid: string | null) {
  const auth = withAuth(uid);
  const feed = fakeSubscription();
  const hook = renderHook(() => useCustomCollection<Item>(feed.subscribe), {
    wrapper: auth.wrapper,
  });
  return { ...hook, ...feed, auth, state: () => hook.result.current };
}

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe('useCustomCollection', () => {
  test('loads until the first snapshot, then shows its items', () => {
    const h = renderCollection('ania');
    expect(h.state()).toMatchObject({ items: [], isLoading: true });
    expect(h.subscribe).toHaveBeenCalledTimes(1);

    h.subscriptions[0].emit(items('a', 'b'));
    expect(h.state()).toMatchObject({ items: items('a', 'b'), isLoading: false });

    h.subscriptions[0].emit(items('b'));
    expect(h.state().items).toEqual(items('b'));
  });

  test('does not subscribe while signed out', () => {
    const h = renderCollection(null);
    expect(h.subscribe).not.toHaveBeenCalled();
    expect(h.state().items).toEqual([]);
  });

  test("switching user hides the previous user's items and subscribes for the new one", () => {
    const h = renderCollection('ania');
    h.subscriptions[0].emit(items('ania-word'));

    h.auth.signInAs('bartek');
    h.rerender();

    expect(h.subscriptions[0].closed).toBe(true);
    expect(h.state()).toMatchObject({ items: [], isLoading: true });
    expect(h.subscribe).toHaveBeenCalledTimes(2);
    h.subscriptions[1].emit(items('bartek-word'));
    expect(h.state().items).toEqual(items('bartek-word'));
  });

  test('signing out closes the subscription and clears the items', () => {
    const h = renderCollection('ania');
    h.subscriptions[0].emit(items('ania-word'));

    h.auth.signOut();
    h.rerender();

    expect(h.subscriptions[0].closed).toBe(true);
    expect(h.state()).toMatchObject({ items: [], isLoading: true });
  });

  test('a local edit shows until the next snapshot replaces it', () => {
    const h = renderCollection('ania');
    h.subscriptions[0].emit(items('a'));
    act(() => h.state().setItems(items('a', 'draft')));
    expect(h.state().items).toEqual(items('a', 'draft'));

    h.subscriptions[0].emit(items('a', 'saved'));
    expect(h.state().items).toEqual(items('a', 'saved'));
  });

  // BUG: the real subscribe (createCustomCollectionStorage) runs an async snapshot handler
  // that awaits IndexedDB before calling onChange, so a snapshot already in flight still
  // calls onChange after the hook unsubscribed. useCustomCollection applies it anyway, so
  // after a user switch the previous user's custom items appear (and isLoading turns
  // false) until the new user's first snapshot lands. Rare: it needs the account to
  // change directly from one user to another (no signed-out step in between) while a
  // snapshot is being processed. Expected: the late snapshot is ignored. Actual: the new
  // user sees the old user's items.
  test.fails('a late snapshot from the previous user is ignored after switching user', () => {
    const h = renderCollection('ania');
    h.auth.signInAs('bartek');
    h.rerender();
    expect(h.subscriptions[0].closed).toBe(true);

    h.subscriptions[0].emit(items('ania-word'));

    expect(h.state()).toMatchObject({ items: [], isLoading: true });
  });
});

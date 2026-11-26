import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSyncProps } from '../../src/hooks/useSyncProps';

interface Props {
  items: string[];
  label: string;
}

/**
 * The review providers' pattern: local state seeded from a prop, editable locally, and
 * replaced whenever the parent passes new props (e.g. fresh data after a background sync).
 */
function renderSeeded(initialItems: string[]) {
  const syncs = vi.fn();
  const hook = renderHook(
    ({ items, label }: Props) => {
      const [state, setState] = useState(items);
      useSyncProps({ items, label }, () => {
        syncs();
        setState(items);
      });
      return { items: state, setItems: setState };
    },
    { initialProps: { items: initialItems, label: 'list' } }
  );
  return { ...hook, syncs, items: () => hook.result.current.items };
}

describe('useSyncProps', () => {
  test('does not sync on the first render', () => {
    const h = renderSeeded(['a']);
    expect(h.syncs).not.toHaveBeenCalled();
    expect(h.items()).toEqual(['a']);
  });

  test('keeps local edits while the props keep the same references', () => {
    const items = ['a'];
    const h = renderSeeded(items);

    act(() => h.result.current.setItems(['a', 'local']));
    h.rerender({ items, label: 'list' });

    expect(h.items()).toEqual(['a', 'local']);
    expect(h.syncs).not.toHaveBeenCalled();
  });

  test('replaces local state when a tracked prop changes', () => {
    const h = renderSeeded(['a']);
    act(() => h.result.current.setItems(['a', 'local']));

    h.rerender({ items: ['fresh'], label: 'list' });

    expect(h.items()).toEqual(['fresh']);
    expect(h.syncs).toHaveBeenCalledTimes(1);
  });

  test('a change to any one tracked prop triggers the sync', () => {
    const items = ['a'];
    const h = renderSeeded(items);
    act(() => h.result.current.setItems(['local']));

    h.rerender({ items, label: 'renamed' });

    expect(h.items()).toEqual(['a']);
  });

  test('compares by reference: an equal but new array still counts as a change', () => {
    const h = renderSeeded(['a']);
    act(() => h.result.current.setItems(['local']));

    h.rerender({ items: ['a'], label: 'list' });

    expect(h.items()).toEqual(['a']);
  });

  test('syncs once per change, so edits made after a sync are kept', () => {
    const h = renderSeeded(['a']);
    const fresh = ['fresh'];

    h.rerender({ items: fresh, label: 'list' });
    act(() => h.result.current.setItems(['edited after sync']));
    h.rerender({ items: fresh, label: 'list' });

    expect(h.syncs).toHaveBeenCalledTimes(1);
    expect(h.items()).toEqual(['edited after sync']);
  });
});

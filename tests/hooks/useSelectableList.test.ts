import { expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelectableList } from '../../src/hooks/useSelectableList';

function renderList(initial: string[] = ['jeden', 'dwa', 'trzy']) {
  const hook = renderHook(() => useSelectableList<string>());
  act(() => hook.result.current.show(initial));
  return { list: () => hook.result.current };
}

test('new items start fully selected', () => {
  const { list } = renderList();
  expect(list().selectedItems).toEqual(['jeden', 'dwa', 'trzy']);
});

test('toggling an item deselects it, and toggling again reselects it in its place', () => {
  const { list } = renderList();
  act(() => list().toggle(1));
  expect(list().selectedItems).toEqual(['jeden', 'trzy']);
  act(() => list().toggle(1));
  expect(list().selectedItems).toEqual(['jeden', 'dwa', 'trzy']);
});

test('removing the selection keeps only the unselected items, with nothing selected', () => {
  const { list } = renderList(['a', 'b', 'c', 'd']);
  act(() => list().toggle(0));
  act(() => list().toggle(2));
  act(() => list().removeSelected());

  expect(list().items).toEqual(['a', 'c']);
  expect(list().selectedItems).toEqual([]);
});

test('showing new items replaces the old ones and selects all of them', () => {
  const { list } = renderList(['a', 'b', 'c']);
  act(() => list().toggle(0));
  act(() => list().show(['x', 'y']));
  expect(list().items).toEqual(['x', 'y']);
  expect(list().selectedItems).toEqual(['x', 'y']);
});

test('clearing empties the items and the selection', () => {
  const { list } = renderList();
  act(() => list().clear());
  expect(list().items).toEqual([]);
  expect(list().selected.size).toBe(0);
});

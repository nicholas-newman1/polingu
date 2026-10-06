import { useCallback, useMemo, useState } from 'react';

/** A list of candidate items (e.g. AI suggestions) where the user picks a subset; new items start fully selected. */
export function useSelectableList<T>() {
  const [items, setItems] = useState<T[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const show = useCallback((next: T[]) => {
    setItems(next);
    setSelected(new Set(next.map((_, i) => i)));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const removeSelected = useCallback(() => {
    setItems((prev) => prev.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  }, [selected]);

  const selectedItems = useMemo(() => items.filter((_, i) => selected.has(i)), [items, selected]);

  return { items, selected, selectedItems, show, clear, toggle, removeSelected };
}

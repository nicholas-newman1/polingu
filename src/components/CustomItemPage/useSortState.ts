import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<F extends string> {
  sortField: F;
  sortDirection: SortDirection;
  handleSort: (field: F) => void;
}

/** Clicking the active column flips direction; clicking another column sorts it ascending. */
export function useSortState<F extends string>(initialField: F): SortState<F> {
  const [sortField, setSortField] = useState(initialField);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: F) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return { sortField, sortDirection, handleSort };
}

export function sortItems<T, F extends string>(
  items: T[],
  comparators: Record<F, (a: T, b: T) => number>,
  { sortField, sortDirection }: Pick<SortState<F>, 'sortField' | 'sortDirection'>
): T[] {
  const compare = comparators[sortField];
  return [...items].sort((a, b) => (sortDirection === 'asc' ? compare(a, b) : -compare(a, b)));
}

export const byPolish = (a: { polish: string }, b: { polish: string }) =>
  a.polish.localeCompare(b.polish, 'pl');

export const byEnglish = (a: { english: string }, b: { english: string }) =>
  a.english.localeCompare(b.english);

export const byCreatedAt = (a: { createdAt: number }, b: { createdAt: number }) =>
  a.createdAt - b.createdAt;

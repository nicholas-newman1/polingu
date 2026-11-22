import { useState } from 'react';

/** Paginate an already filtered and sorted list; resetKey identifies the current view. */
export function usePagination<T>(items: T[], resetKey: string) {
  const [state, setState] = useState({ page: 0, rowsPerPage: 25, resetKey });
  const count = items.length;
  const lastPage = Math.max(0, Math.ceil(count / state.rowsPerPage) - 1);
  const page = state.resetKey === resetKey ? Math.min(state.page, lastPage) : 0;

  // Adjust before rendering so filters and deletions never leave an empty, invalid page.
  if (state.resetKey !== resetKey || state.page !== page) {
    setState({ ...state, page, resetKey });
  }

  return {
    paginatedItems: items.slice(page * state.rowsPerPage, (page + 1) * state.rowsPerPage),
    count,
    page,
    rowsPerPage: state.rowsPerPage,
    onPageChange: (nextPage: number) => setState((prev) => ({ ...prev, page: nextPage })),
    onRowsPerPageChange: (rowsPerPage: number) =>
      setState((prev) => ({ ...prev, page: 0, rowsPerPage })),
  };
}

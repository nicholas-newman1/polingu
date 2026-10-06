import { TableCell, TableSortLabel } from '@mui/material';
import type { SortState } from './useSortState';

interface SortableHeaderCellProps<F extends string> {
  field: F;
  label: string;
  sort: SortState<F>;
}

export function SortableHeaderCell<F extends string>({
  field,
  label,
  sort,
}: SortableHeaderCellProps<F>) {
  const active = sort.sortField === field;
  return (
    <TableCell>
      <TableSortLabel
        active={active}
        direction={active ? sort.sortDirection : 'asc'}
        onClick={() => sort.handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

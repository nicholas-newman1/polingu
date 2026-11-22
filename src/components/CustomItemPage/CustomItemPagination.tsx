import { TablePagination } from '@mui/material';

interface CustomItemPaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export function CustomItemPagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: CustomItemPaginationProps) {
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={[10, 25, 50]}
      onPageChange={(_, nextPage) => onPageChange(nextPage)}
      onRowsPerPageChange={(event) => onRowsPerPageChange(Number(event.target.value))}
      sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end' } }}
    />
  );
}

import type { ReactNode } from 'react';
import { TableCell, TableHead, TableRow, Typography } from '@mui/material';

interface FilterResultCountProps {
  visible: boolean;
  shown: number;
  total: number;
  noun: string;
}

export function FilterResultCount({ visible, shown, total, noun }: FilterResultCountProps) {
  if (!visible) return null;
  return (
    <Typography variant="body2" color="text.secondary">
      {shown} of {total} {noun}
    </Typography>
  );
}

interface CustomItemTableHeadProps {
  isAdmin: boolean;
  children: ReactNode;
}

/** Table head with the leading Actions (and admin-only Audio) columns every custom item table has. */
export function CustomItemTableHead({ isAdmin, children }: CustomItemTableHeadProps) {
  return (
    <TableHead>
      <TableRow>
        <TableCell>Actions</TableCell>
        {isAdmin && <TableCell>Audio</TableCell>}
        {children}
      </TableRow>
    </TableHead>
  );
}

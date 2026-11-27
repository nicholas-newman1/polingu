import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  /** The destructive action, e.g. "Delete" or "Reset". */
  confirmLabel: string;
  cancelLabel?: string;
}

interface ConfirmDialogProps extends Partial<ConfirmOptions> {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button onClick={onConfirm} color="error">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import type { ReactNode } from 'react';
import { Box, Button } from '@mui/material';
import { styled } from '../lib/styled';
import { ModalActions } from './modalStyles';

const RightActions = styled(Box)({
  display: 'flex',
  gap: 8,
});

interface ModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  destructiveAction?: { label: string; icon: ReactNode; onClick: () => void };
}

export function ModalFooter({
  onCancel,
  onSubmit,
  submitLabel,
  submitDisabled,
  destructiveAction,
}: ModalFooterProps) {
  return (
    <ModalActions $spread>
      <Box>
        {destructiveAction && (
          <Button
            onClick={destructiveAction.onClick}
            color="error"
            startIcon={destructiveAction.icon}
          >
            {destructiveAction.label}
          </Button>
        )}
      </Box>
      <RightActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </RightActions>
    </ModalActions>
  );
}

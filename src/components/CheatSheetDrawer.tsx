import type { ReactNode } from 'react';
import { Drawer, Box, Typography, IconButton, styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useBackClose } from '../hooks/useBackClose';

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: 'sticky',
  top: 0,
  backgroundColor: theme.palette.background.paper,
  zIndex: 1,
}));

const DrawerContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingBottom: theme.spacing(11),
  overflowY: 'auto',
}));

interface CheatSheetDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function CheatSheetDrawer({ open, onClose, title, children }: CheatSheetDrawerProps) {
  useBackClose(open, onClose);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          height: '100%',
        },
      }}
    >
      <DrawerHeader>
        <Typography variant="h6" fontWeight={500}>
          {title}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DrawerHeader>
      <DrawerContent>{children}</DrawerContent>
    </Drawer>
  );
}

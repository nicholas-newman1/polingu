import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  styled,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import { useState, useEffect } from 'react';
import { useTranslationContext } from '../hooks/useTranslationContext';
import { useBackClose } from '../hooks/useBackClose';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 400,
    margin: theme.spacing(2),
    textAlign: 'center',
  },
}));

const IconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  '& .MuiSvgIcon-root': {
    fontSize: 48,
    color: theme.palette.warning.main,
  },
}));

function formatTimeRemaining(resetTime: string): string {
  const now = new Date();
  const reset = new Date(resetTime);
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'shortly';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

export function LimitReachedDialog() {
  const {
    showLimitReached: open,
    closeLimitReached: onClose,
    limitResetTime: resetTime,
  } = useTranslationContext();
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(resetTime));

  useBackClose(open, onClose);

  useEffect(() => {
    if (!open) return;

    setTimeRemaining(formatTimeRemaining(resetTime));

    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(resetTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [open, resetTime]);

  return (
    <StyledDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>
        <IconContainer>
          <BlockIcon />
        </IconContainer>
        You've hit your translation limit for the day
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Your limit will reset in {timeRemaining}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Got it
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}


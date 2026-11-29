import { Box } from '@mui/material';
import { styled } from '../lib/styled';
import { BOTTOM_MENU_BAR_HEIGHT } from '../constants/layout';

export const TrackIcon = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

export const MINI_BAR_HEIGHT = 64;

/** A bar pinned above the bottom menu that opens a player when tapped. */
export const MiniBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_BAR_HEIGHT,
  left: 0,
  right: 0,
  height: MINI_BAR_HEIGHT,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 1, 0, 2),
  zIndex: theme.zIndex.appBar + 1,
  cursor: 'pointer',
}));

export const MiniBarTrackInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

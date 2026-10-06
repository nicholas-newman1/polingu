import { Box } from '@mui/material';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
import { DRAWER_WIDTH } from '../../../constants/layout';

export const ReaderNavigationBar = styled(Box)<{ $bottom: number; $gap: number }>(
  ({ theme, $bottom, $gap }) => ({
    position: 'fixed',
    bottom: $bottom,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing($gap),
    padding: theme.spacing(1),
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
    backdropFilter: 'blur(8px)',
    borderTop: `1px solid ${theme.palette.divider}`,
    zIndex: 10,
    [theme.breakpoints.up('md')]: {
      left: DRAWER_WIDTH,
    },
  })
);

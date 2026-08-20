import { Box, Card, IconButton } from '@mui/material';
import { styled } from '../../../lib/styled';

export const BookCard = styled(Card)({
  position: 'relative',
});

export const BookCover = styled(Box)<{ $colorMain?: string; $colorLight?: string }>(
  ({ theme, $colorMain, $colorLight }) => ({
    height: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${$colorLight || theme.palette.primary.light} 0%, ${$colorMain || theme.palette.primary.main} 100%)`,
    color: '#fff',
    [theme.breakpoints.up('sm')]: {
      height: 220,
    },
  })
);

export const MenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 1,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  '&:hover': {
    backgroundColor: theme.palette.grey[100],
  },
}));

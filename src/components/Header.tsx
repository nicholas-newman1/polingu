import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  styled,
} from '@mui/material';
import { Person } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import getFirstName from '../lib/utils/getFirstName';

const BrandingSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  display: 'none',
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

const GuestChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(202, 138, 4, 0.1)',
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

const UserIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
}));

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    handleMenuClose();
    onSignOut();
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <BrandingSection>
        <Typography variant="h6">🇵🇱</Typography>
        <HeaderTitle variant="h6" color="text.primary">
          Polish
        </HeaderTitle>
      </BrandingSection>

      <Stack direction="row" alignItems="center" spacing={1}>
        {user ? (
          <>
            <UserIconButton size="small" onClick={handleMenuOpen}>
              <Person />
            </UserIconButton>
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: { minWidth: 200, mt: 1 },
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {getFirstName(user.displayName, user.email)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <GuestChip label="Guest mode" size="small" />
            <Button
              component={Link}
              to="/"
              size="small"
              sx={{ color: 'text.disabled', textDecoration: 'underline' }}
            >
              Sign in
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}

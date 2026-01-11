import { Stack, Typography, Chip, Button, styled } from '@mui/material';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { getFirstName } from '../lib/utils';

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  display: 'none',
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

const UserEmail = styled(Typography)(({ theme }) => ({
  maxWidth: 100,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  [theme.breakpoints.up('sm')]: {
    maxWidth: 150,
  },
}));

const SignOutButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.disabled,
  textDecoration: 'underline',
}));

const GuestChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(202, 138, 4, 0.1)',
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: { xs: 2, sm: 3 } }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h6">🇵🇱</Typography>
        <HeaderTitle variant="h6" color="text.primary">
          Polish Declension
        </HeaderTitle>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1}>
        {user ? (
          <>
            <UserEmail variant="body2" color="text.disabled">
              {getFirstName(user.displayName, user.email)}
            </UserEmail>
            <SignOutButton size="small" onClick={onSignOut}>
              Sign out
            </SignOutButton>
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

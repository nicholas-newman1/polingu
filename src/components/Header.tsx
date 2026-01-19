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
  ListItemIcon,
  ListItemText,
  Divider,
  styled,
} from '@mui/material';
import { Person, LibraryBooks, BarChart, ArrowBack } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import getFirstName from '../lib/utils/getFirstName';
import { alpha } from '../lib/theme';

const PageTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: '1.1rem',
});

const GuestChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.warning.main, 0.1),
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

const UserIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
}));

const BackButton = styled(IconButton)(({ theme }) => ({
  marginRight: theme.spacing(1),
  backgroundColor: theme.palette.action.hover,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
}));

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
  pageTitle?: string;
  backPath?: string;
}

export function Header({ user, onSignOut, pageTitle, backPath }: HeaderProps) {
  const navigate = useNavigate();
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

  const handleMyVocabulary = () => {
    handleMenuClose();
    navigate('/my-vocabulary');
  };

  const handleMyDeclensions = () => {
    handleMenuClose();
    navigate('/my-declensions');
  };

  const handleStats = () => {
    handleMenuClose();
    navigate('/stats');
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ width: '100%' }}
    >
      <Stack direction="row" alignItems="center">
        {backPath && (
          <BackButton size="small" onClick={() => navigate(backPath)}>
            <ArrowBack fontSize="small" />
          </BackButton>
        )}
        {pageTitle && (
          <PageTitle variant="h6" color="text.primary">
            {pageTitle}
          </PageTitle>
        )}
      </Stack>

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
              <MenuItem onClick={handleMyVocabulary}>
                <ListItemIcon>
                  <LibraryBooks fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Vocabulary</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleMyDeclensions}>
                <ListItemIcon>
                  <LibraryBooks fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Declensions</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleStats}>
                <ListItemIcon>
                  <BarChart fontSize="small" />
                </ListItemIcon>
                <ListItemText>Statistics</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <GuestChip label="Guest mode" size="small" />
            <Button
              component={Link}
              to="/login"
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

import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  styled,
} from '@mui/material';
import { BoxIconButton } from './BoxIconButton';
import {
  Person,
  Abc,
  School,
  Translate,
  BarChart,
  ArrowBack,
  Settings,
  Add,
  TextSnippet,
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import getFirstName from '../lib/utils/getFirstName';
import { alpha } from '../lib/theme';
import { useAddToVocabulary } from '../hooks/useAddToVocabulary';
import { useAddSentence } from '../hooks/useAddSentence';

const PageTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: '1.1rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const GuestChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.warning.main, 0.1),
  color: theme.palette.warning.main,
  fontWeight: 500,
}));

const BackButton = styled(BoxIconButton)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
  pageTitle?: string;
  backPath?: string;
}

export function Header({ user, onSignOut, pageTitle, backPath }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const addToVocabulary = useAddToVocabulary();
  const addSentence = useAddSentence();

  const handleBack = () => {
    if (!backPath) return;
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(backPath);
    }
  };
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [quickAddAnchorEl, setQuickAddAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const quickAddOpen = Boolean(quickAddAnchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickAddOpen = (event: React.MouseEvent<HTMLElement>) => {
    setQuickAddAnchorEl(event.currentTarget);
  };

  const handleQuickAddClose = () => {
    setQuickAddAnchorEl(null);
  };

  const handleQuickAddVocab = () => {
    handleQuickAddClose();
    addToVocabulary?.openAddToVocabulary('', '');
  };

  const handleQuickAddSentence = () => {
    handleQuickAddClose();
    addSentence?.openAddSentence();
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

  const handleMySentences = () => {
    handleMenuClose();
    navigate('/my-sentences');
  };

  const handleStats = () => {
    handleMenuClose();
    navigate('/stats');
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate('/settings');
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ width: '100%' }}
    >
      <Stack direction="row" alignItems="center" sx={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
        {backPath && (
          <BackButton size="small" onClick={handleBack}>
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
            <BoxIconButton size="small" onClick={handleQuickAddOpen} aria-label="Quick add">
              <Add />
            </BoxIconButton>
            <Menu
              anchorEl={quickAddAnchorEl}
              open={quickAddOpen}
              onClose={handleQuickAddClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: { minWidth: 180, mt: 1 },
                },
              }}
            >
              <MenuItem onClick={handleQuickAddVocab}>
                <ListItemIcon>
                  <Abc fontSize="small" />
                </ListItemIcon>
                <ListItemText>Vocabulary</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleQuickAddSentence}>
                <ListItemIcon>
                  <TextSnippet fontSize="small" />
                </ListItemIcon>
                <ListItemText>Sentence</ListItemText>
              </MenuItem>
            </Menu>
            <BoxIconButton size="small" onClick={handleMenuOpen} aria-label="Account menu">
              <Person />
            </BoxIconButton>
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
                  <Abc fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Vocabulary</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleMyDeclensions}>
                <ListItemIcon>
                  <School fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Declensions</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleMySentences}>
                <ListItemIcon>
                  <Translate fontSize="small" />
                </ListItemIcon>
                <ListItemText>My Sentences</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleStats}>
                <ListItemIcon>
                  <BarChart fontSize="small" />
                </ListItemIcon>
                <ListItemText>Statistics</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText>Settings</ListItemText>
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

import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu, School, Translate, Close } from '@mui/icons-material';
import { Header } from './Header';
import { DeclensionCheatSheetDrawer } from './DeclensionCheatSheetDrawer';
import { ConsonantsCheatSheetDrawer } from './ConsonantsCheatSheetDrawer';
import { YiRuleCheatSheetDrawer } from './YiRuleCheatSheetDrawer';
import { TranslatorModal } from './TranslatorModal';
import { LimitReachedDialog } from './LimitReachedDialog';
import { BottomMenuBar } from './BottomMenuBar';
import { useAuthContext } from '../hooks/useAuthContext';

const DRAWER_WIDTH = 260;

const PageContainer = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
});

const MainArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.up('md')]: {
    marginLeft: DRAWER_WIDTH,
  },
}));

const HEADER_HEIGHT = 64;

const HeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  height: HEADER_HEIGHT,
  [theme.breakpoints.up('md')]: {
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 3),
  },
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  paddingBottom: theme.spacing(10),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(3),
    paddingBottom: theme.spacing(10),
  },
}));

const MenuButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 2),
  height: HEADER_HEIGHT,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const NavItem = styled(ListItemButton)<{ active?: boolean }>(({ theme, active }) => ({
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 1),
  backgroundColor: active ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: active ? theme.palette.action.selected : theme.palette.action.hover,
  },
}));

function DrawerContent({
  isActive,
  onNavigate,
  onClose,
  showCloseButton,
}: {
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onClose: () => void;
  showCloseButton: boolean;
}) {
  return (
    <>
      <DrawerHeader>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🇵🇱 Polish
        </Typography>
        {showCloseButton && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </DrawerHeader>

      <List sx={{ pt: 2 }}>
        <ListItem disablePadding>
          <NavItem
            active={isActive('/app') && !isActive('/app/sentences')}
            onClick={() => onNavigate('/app')}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <School color={isActive('/app') && !isActive('/app/sentences') ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText
              primary="Declension"
              secondary="Practice noun declensions"
              primaryTypographyProps={{
                fontWeight: isActive('/app') && !isActive('/app/sentences') ? 600 : 400,
              }}
            />
          </NavItem>
        </ListItem>

        <ListItem disablePadding>
          <NavItem
            active={isActive('/app/sentences')}
            onClick={() => onNavigate('/app/sentences')}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Translate color={isActive('/app/sentences') ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText
              primary="Sentences"
              secondary="Translate full sentences"
              primaryTypographyProps={{
                fontWeight: isActive('/app/sentences') ? 600 : 400,
              }}
            />
          </NavItem>
        </ListItem>
      </List>
    </>
  );
}

export function Layout() {
  const { user, signOut } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <PageContainer>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              backgroundColor: 'background.default',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          <DrawerContent
            isActive={isActive}
            onNavigate={handleNavigation}
            onClose={() => {}}
            showCloseButton={false}
          />
        </Drawer>
      ) : (
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              backgroundColor: 'background.default',
            },
          }}
        >
          <DrawerContent
            isActive={isActive}
            onNavigate={handleNavigation}
            onClose={() => setMobileDrawerOpen(false)}
            showCloseButton={true}
          />
        </Drawer>
      )}

      <MainArea>
        <HeaderRow>
          <MenuButton onClick={() => setMobileDrawerOpen(true)} size="small">
            <Menu />
          </MenuButton>
          <Box sx={{ flex: { xs: 1, md: 'none' } }}>
            <Header user={user} onSignOut={handleSignOut} />
          </Box>
        </HeaderRow>

        <ContentArea>
          <Outlet />
        </ContentArea>
      </MainArea>

      <DeclensionCheatSheetDrawer />
      <ConsonantsCheatSheetDrawer />
      <YiRuleCheatSheetDrawer />
      <TranslatorModal />
      <LimitReachedDialog />

      <BottomMenuBar showTranslator={!!user} />
    </PageContainer>
  );
}


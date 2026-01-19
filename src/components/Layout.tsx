import { useState, useCallback } from 'react';
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
  Skeleton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { styled } from '../lib/styled';
import {
  Menu,
  School,
  Translate,
  Close,
  Abc,
  Home,
  Check,
} from '@mui/icons-material';
import { useReviewData } from '../hooks/useReviewData';
import { useBackClose } from '../hooks/useBackClose';
import type { ReviewCounts } from '../contexts/ReviewDataContext';
import { alpha } from '../lib/theme';
import { Header } from './Header';
import { DeclensionCheatSheetDrawer } from './DeclensionCheatSheetDrawer';
import { ConsonantsCheatSheetDrawer } from './ConsonantsCheatSheetDrawer';
import { YiRuleCheatSheetDrawer } from './YiRuleCheatSheetDrawer';
import { TranslatorModal } from './TranslatorModal';
import { LimitReachedDialog } from './LimitReachedDialog';
import { BottomMenuBar } from './BottomMenuBar';
import { useAuthContext } from '../hooks/useAuthContext';
import { SITE_NAME } from '../constants';
import { SiteLogo } from './SiteLogo';

export const DRAWER_WIDTH = 260;

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

const StyledNavItem = styled(ListItemButton)<{ $active?: boolean }>(
  ({ theme, $active }) => ({
    borderRadius: theme.spacing(1),
    margin: theme.spacing(0.5, 1),
    backgroundColor: $active ? theme.palette.action.selected : 'transparent',
    '&:hover': {
      backgroundColor: $active
        ? theme.palette.action.selected
        : theme.palette.action.hover,
    },
  })
);

const ReviewBadge = styled(Box)<{ $complete?: boolean }>(
  ({ theme, $complete }) => ({
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0 6px',
    backgroundColor: $complete
      ? alpha(theme.palette.success.main, 0.15)
      : alpha(theme.palette.primary.main, 0.1),
    color: $complete ? theme.palette.success.main : theme.palette.primary.main,
  })
);

interface NavItemProps {
  path: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  reviewCount?: number;
  loading?: boolean;
  onNavigate: (path: string) => void;
}

function NavItem({
  path,
  icon,
  label,
  description,
  active,
  reviewCount,
  loading,
  onNavigate,
}: NavItemProps) {
  const hasBadge = reviewCount !== undefined || loading;
  const isComplete = reviewCount === 0;

  return (
    <ListItem disablePadding>
      <StyledNavItem $active={active} onClick={() => onNavigate(path)}>
        <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
        <ListItemText
          primary={label}
          secondary={description}
          slotProps={{ primary: { fontWeight: active ? 600 : 400 } }}
        />
        {hasBadge &&
          (loading ? (
            <Skeleton
              variant="rounded"
              width={24}
              height={24}
              sx={{ borderRadius: 12 }}
            />
          ) : (
            <ReviewBadge $complete={isComplete}>
              {isComplete ? <Check sx={{ fontSize: 16 }} /> : reviewCount}
            </ReviewBadge>
          ))}
      </StyledNavItem>
    </ListItem>
  );
}

const NAV_ITEMS: Array<{
  path: string;
  icon: typeof Home;
  label: string;
  description: string;
  reviewCountKey?: keyof ReviewCounts;
}> = [
  {
    path: '/dashboard',
    icon: Home,
    label: 'Dashboard',
    description: 'Home',
  },
  {
    path: '/declension',
    icon: School,
    label: 'Declension',
    description: 'Practice noun declensions',
    reviewCountKey: 'declension',
  },
  {
    path: '/vocabulary',
    icon: Abc,
    label: 'Vocabulary',
    description: 'Top 1000 Polish words',
    reviewCountKey: 'vocabulary',
  },
  {
    path: '/sentences',
    icon: Translate,
    label: 'Sentences',
    description: 'Translate full sentences',
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/declension': 'Declension',
  '/vocabulary': 'Vocabulary',
  '/vocabulary/recognition': 'Recognition',
  '/vocabulary/production': 'Production',
  '/sentences': 'Sentences',
  '/my-vocabulary': 'My Vocabulary',
  '/my-declensions': 'My Declensions',
  '/stats': 'Statistics',
};

const BACK_ROUTES: Record<string, string> = {
  '/vocabulary/recognition': '/vocabulary',
  '/vocabulary/production': '/vocabulary',
};

function DrawerContent({
  currentPath,
  onNavigate,
  onClose,
  showCloseButton,
  reviewCounts,
  loading,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
  showCloseButton: boolean;
  reviewCounts: ReviewCounts;
  loading: boolean;
}) {
  const isActive = (path: string) => currentPath === path;

  return (
    <>
      <DrawerHeader>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <SiteLogo size={28} /> {SITE_NAME}
        </Typography>
        {showCloseButton && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </DrawerHeader>

      <List sx={{ pt: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const reviewCount = item.reviewCountKey
            ? reviewCounts[item.reviewCountKey]
            : undefined;
          return (
            <NavItem
              key={item.path}
              path={item.path}
              icon={<item.icon color={active ? 'primary' : 'inherit'} />}
              label={item.label}
              description={item.description}
              active={active}
              reviewCount={reviewCount}
              loading={item.reviewCountKey ? loading : undefined}
              onNavigate={onNavigate}
            />
          );
        })}
      </List>
    </>
  );
}

export function Layout() {
  const { user, signOut } = useAuthContext();
  const { counts, loading: countsLoading } = useReviewData();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  useBackClose(mobileDrawerOpen, closeMobileDrawer);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
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
            currentPath={location.pathname}
            onNavigate={handleNavigation}
            onClose={() => {}}
            showCloseButton={false}
            reviewCounts={counts}
            loading={countsLoading}
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
            currentPath={location.pathname}
            onNavigate={handleNavigation}
            onClose={() => setMobileDrawerOpen(false)}
            showCloseButton={true}
            reviewCounts={counts}
            loading={countsLoading}
          />
        </Drawer>
      )}

      <MainArea>
        <HeaderRow>
          <MenuButton onClick={() => setMobileDrawerOpen(true)} size="small">
            <Menu />
          </MenuButton>
          <Box sx={{ flex: 1 }}>
            <Header
              user={user}
              onSignOut={handleSignOut}
              pageTitle={PAGE_TITLES[location.pathname]}
              backPath={BACK_ROUTES[location.pathname]}
            />
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

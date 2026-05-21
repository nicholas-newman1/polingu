import { useState, useCallback, useContext } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  SwipeableDrawer,
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
import { BoxIconButton } from './BoxIconButton';
import { Menu, Close, Home, Check, AutoAwesome, Storage } from '@mui/icons-material';
import { useReviewData } from '../hooks/useReviewData';
import { useBackClose } from '../hooks/useBackClose';
import type { ReviewCounts } from '../contexts/review';
import { alpha } from '../lib/theme';
import { Header } from './Header';
import { DeclensionCheatSheetDrawer } from './BottomMenu/DeclensionCheatSheetDrawer';
import { ConsonantsCheatSheetDrawer } from './BottomMenu/ConsonantsCheatSheetDrawer';
import { YiRuleCheatSheetDrawer } from './BottomMenu/YiRuleCheatSheetDrawer';
import { ConjugationCheatSheetDrawer } from './BottomMenu/ConjugationCheatSheetDrawer';
import { TranslatorModal } from './BottomMenu/TranslatorModal';
import { LimitReachedDialog } from './LimitReachedDialog';
import { BottomMenuBar } from './BottomMenu/BottomMenuBar';
import { useAuthContext } from '../hooks/useAuthContext';
import { SITE_NAME } from '../constants';
import { getOrderedDashboardItems } from '../constants/navigation';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { SiteLogo } from './SiteLogo';
import { PageTitleContext, PageTitleProvider } from '../contexts/PageTitleContext';
import { AddToVocabularyProvider } from '../contexts/AddToVocabularyContext';
import { AddSentenceProvider } from '../contexts/AddSentenceContext';
import { ListeningMiniBar } from './ListeningMiniBar';

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
  position: 'sticky',
  top: 0,
  zIndex: theme.zIndex.appBar + 1,
  backgroundColor: theme.palette.background.default,
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
  paddingBottom: theme.spacing(16),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(3),
    paddingBottom: theme.spacing(16),
  },
}));

const MenuButton = styled(BoxIconButton)(({ theme }) => ({
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

const StyledNavItem = styled(ListItemButton)<{ $active?: boolean }>(({ theme, $active }) => ({
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 1),
  backgroundColor: $active ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: $active ? theme.palette.action.selected : theme.palette.action.hover,
  },
}));

const ReviewBadge = styled(Box)<{ $complete?: boolean }>(({ theme, $complete }) => ({
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
}));

interface NavItemProps {
  path: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  reviewCount?: number;
  loading?: boolean;
  onNavigate: (path: string) => void;
}

function NavItem({ path, icon, label, active, reviewCount, loading, onNavigate }: NavItemProps) {
  const hasBadge = reviewCount !== undefined || loading;
  const isComplete = reviewCount === 0;

  return (
    <ListItem disablePadding>
      <StyledNavItem $active={active} onClick={() => onNavigate(path)}>
        <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
        <ListItemText primary={label} slotProps={{ primary: { fontWeight: active ? 600 : 400 } }} />
        {hasBadge &&
          (loading ? (
            <Skeleton variant="rounded" width={24} height={24} sx={{ borderRadius: 12 }} />
          ) : (
            <ReviewBadge $complete={isComplete}>
              {isComplete ? <Check sx={{ fontSize: 16 }} /> : reviewCount}
            </ReviewBadge>
          ))}
      </StyledNavItem>
    </ListItem>
  );
}

interface NavItemConfig {
  path: string;
  icon: typeof Home;
  label: string;
  reviewCountKey?: keyof ReviewCounts;
  adminOnly?: boolean;
}

const DASHBOARD_NAV_ITEM: NavItemConfig = {
  path: '/dashboard',
  icon: Home,
  label: 'Dashboard',
};

const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  {
    path: '/admin/content',
    icon: Storage,
    label: 'Content',
    adminOnly: true,
  },
  {
    path: '/admin/generator',
    icon: AutoAwesome,
    label: 'Generator',
    adminOnly: true,
  },
];

function buildNavItems(dashboardOrder: string[] | undefined): NavItemConfig[] {
  const ordered = getOrderedDashboardItems(dashboardOrder).map((item) => ({
    path: item.path,
    icon: item.icon,
    label: item.label,
    reviewCountKey: item.kind === 'feature' ? item.statsKey : undefined,
  }));

  return [DASHBOARD_NAV_ITEM, ...ordered, ...ADMIN_NAV_ITEMS];
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/declension': 'Declension',
  '/vocabulary': 'Vocabulary',
  '/vocabulary/recognition': 'Recognition',
  '/vocabulary/production': 'Production',
  '/sentences': 'Sentences',
  '/sentences/recognition': 'Recognition',
  '/sentences/production': 'Production',
  '/conjugation': 'Conjugation',
  '/conjugation/recognition': 'Recognition',
  '/conjugation/production': 'Production',
  '/aspect-pairs': 'Aspect Pairs',
  '/consonant-driller': 'Consonant Driller',
  '/my-vocabulary': 'My Vocabulary',
  '/my-declensions': 'My Declensions',
  '/my-sentences': 'My Sentences',
  '/library': 'Library',
  '/reader': 'Reader',
  '/audio': 'Audio',
  '/listen': 'Listening',
  '/listen/play': 'Listening',
  '/stats': 'Statistics',
  '/admin/generator': 'Sentence Generator',
};

const BACK_ROUTES: Record<string, string> = {
  '/vocabulary': '/dashboard',
  '/vocabulary/recognition': '/vocabulary',
  '/vocabulary/production': '/vocabulary',
  '/declension': '/dashboard',
  '/sentences': '/dashboard',
  '/sentences/recognition': '/sentences',
  '/sentences/production': '/sentences',
  '/conjugation': '/dashboard',
  '/conjugation/recognition': '/conjugation',
  '/conjugation/production': '/conjugation',
  '/aspect-pairs': '/dashboard',
  '/consonant-driller': '/dashboard',
  '/library': '/dashboard',
  '/audio': '/dashboard',
  '/listen': '/dashboard',
  '/listen/play': '/listen',
  '/admin/content': '/dashboard',
  '/admin/generator': '/dashboard',
};

const BACK_ROUTE_PATTERNS: Array<{ pattern: RegExp; backPath: string }> = [
  { pattern: /^\/reader\//, backPath: '/library' },
  { pattern: /^\/audio\//, backPath: '/audio' },
];

function DrawerContent({
  currentPath,
  onNavigate,
  onClose,
  showCloseButton,
  reviewCounts,
  loading,
  isAdmin,
  navItems,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
  showCloseButton: boolean;
  reviewCounts: ReviewCounts;
  loading: boolean;
  isAdmin: boolean;
  navItems: NavItemConfig[];
}) {
  const isActive = (path: string) => currentPath === path;
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      <DrawerHeader>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SiteLogo size={28} /> {SITE_NAME}
        </Typography>
        {showCloseButton && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </DrawerHeader>

      <List sx={{ pt: 2 }}>
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          const reviewCount = item.reviewCountKey ? reviewCounts[item.reviewCountKey] : undefined;
          return (
            <NavItem
              key={item.path}
              path={item.path}
              icon={<item.icon color={active ? 'primary' : 'inherit'} />}
              label={item.label}
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

function LayoutContent() {
  const { user, signOut, isAdmin } = useAuthContext();
  const { counts, loading: countsLoading } = useReviewData();
  const { settings } = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const pageTitleContext = useContext(PageTitleContext);
  const navItems = buildNavItems(settings.dashboardOrder);

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

  const defaultTitle = PAGE_TITLES[location.pathname];
  const pageTitle = pageTitleContext?.customTitle || defaultTitle;
  return (
    <AddToVocabularyProvider>
      <AddSentenceProvider>
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
                isAdmin={isAdmin}
                navItems={navItems}
              />
            </Drawer>
          ) : (
            <SwipeableDrawer
              anchor="left"
              open={mobileDrawerOpen}
              onOpen={() => setMobileDrawerOpen(true)}
              onClose={() => setMobileDrawerOpen(false)}
              swipeAreaWidth={20}
              disableBackdropTransition
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
                isAdmin={isAdmin}
                navItems={navItems}
              />
            </SwipeableDrawer>
          )}

          <MainArea>
            <HeaderRow>
              <MenuButton
                variant="outlined"
                onClick={() => setMobileDrawerOpen(true)}
                size="small"
                aria-label="Open navigation menu"
              >
                <Menu />
              </MenuButton>
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <Header
                  user={user}
                  onSignOut={handleSignOut}
                  pageTitle={pageTitle}
                  backPath={
                    BACK_ROUTES[location.pathname] ||
                    BACK_ROUTE_PATTERNS.find((p) => p.pattern.test(location.pathname))?.backPath
                  }
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
          <ConjugationCheatSheetDrawer />
          <TranslatorModal />
          <LimitReachedDialog />

          <ListeningMiniBar />
          <BottomMenuBar showTranslator={!!user} />
        </PageContainer>
      </AddSentenceProvider>
    </AddToVocabularyProvider>
  );
}

export function Layout() {
  return (
    <PageTitleProvider>
      <LayoutContent />
    </PageTitleProvider>
  );
}

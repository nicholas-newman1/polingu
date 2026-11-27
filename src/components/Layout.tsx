import { useContext } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { styled } from '../lib/styled';
import { BoxIconButton } from './BoxIconButton';
import Home from '@mui/icons-material/Home';
import { Header } from './Header';
import { QuickAddFab } from './QuickAddFab';
import { ScrollToTopOnNavigate } from './ScrollToTopOnNavigate';
import { DeclensionCheatSheetDrawer } from './BottomMenu/DeclensionCheatSheetDrawer';
import { AdjectiveDeclensionCheatSheetDrawer } from './BottomMenu/AdjectiveDeclensionCheatSheetDrawer';
import { ConsonantsCheatSheetDrawer } from './BottomMenu/ConsonantsCheatSheetDrawer';
import { YiRuleCheatSheetDrawer } from './BottomMenu/YiRuleCheatSheetDrawer';
import { ConjugationCheatSheetDrawer } from './BottomMenu/ConjugationCheatSheetDrawer';
import { TranslatorModal } from './BottomMenu/TranslatorModal';
import { LimitReachedDialog } from './LimitReachedDialog';
import { BottomMenuBar } from './BottomMenu/BottomMenuBar';
import { useAuthContext } from '../hooks/useAuthContext';
import { PageTitleContext, PageTitleProvider } from '../contexts/PageTitleContext';
import { AddToVocabularyProvider } from '../contexts/AddToVocabularyContext';
import { AddSentenceProvider } from '../contexts/AddSentenceContext';
import { ListeningMiniBar } from './ListeningMiniBar';
import { HEADER_HEIGHT } from '../constants/layout';

const PageContainer = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
});

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
});

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
    padding: theme.spacing(0, 3),
  },
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'clip',
  padding: theme.spacing(2),
  paddingBottom: theme.spacing(16),
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(3),
    paddingBottom: theme.spacing(16),
  },
}));

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
  '/settings': 'Settings',
  '/admin/generator': 'Sentence Generator',
};

/**
 * Back arrows for nested pages only; top-level pages use the Home button instead.
 */
const BACK_ROUTES: Record<string, string> = {
  '/vocabulary/recognition': '/vocabulary',
  '/vocabulary/production': '/vocabulary',
  '/sentences/recognition': '/sentences',
  '/sentences/production': '/sentences',
  '/conjugation/recognition': '/conjugation',
  '/conjugation/production': '/conjugation',
  '/listen/play': '/listen',
};

const BACK_ROUTE_PATTERNS: Array<{ pattern: RegExp; backPath: string }> = [
  { pattern: /^\/reader\//, backPath: '/library' },
  { pattern: /^\/audio\//, backPath: '/audio' },
];

function LayoutContent() {
  const { user, signOut } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitleContext = useContext(PageTitleContext);
  const onDashboard = location.pathname === '/dashboard';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const defaultTitle = PAGE_TITLES[location.pathname];
  const pageTitle = pageTitleContext?.customTitle || defaultTitle;
  return (
    <AddToVocabularyProvider>
      <AddSentenceProvider>
        <PageContainer>
          <MainArea>
            <HeaderRow>
              {!onDashboard && (
                <BoxIconButton
                  variant="outlined"
                  onClick={() => navigate('/dashboard')}
                  size="small"
                  aria-label="Home"
                >
                  <Home />
                </BoxIconButton>
              )}
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
              <ScrollToTopOnNavigate />
              <Outlet />
            </ContentArea>
          </MainArea>

          <DeclensionCheatSheetDrawer />
          <AdjectiveDeclensionCheatSheetDrawer />
          <ConsonantsCheatSheetDrawer />
          <YiRuleCheatSheetDrawer />
          <ConjugationCheatSheetDrawer />
          <TranslatorModal />
          <LimitReachedDialog />

          {user && <QuickAddFab />}
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

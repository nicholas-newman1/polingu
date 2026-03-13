import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import { styled } from '../../lib/styled';
import { useAuthContext } from '../../hooks/useAuthContext';
import {
  useVocabulary,
  useDeclension,
  useSentences,
  useConjugation,
} from '../../hooks/useReviewData';
import { VocabularyTab } from './VocabularyTab';
import { DeclensionsTab } from './DeclensionsTab';
import { SentencesTab } from './SentencesTab';
import { VerbsTab } from './VerbsTab';

const PageContainer = styled(Box)(() => ({
  maxWidth: 900,
  margin: '0 auto',
  width: '100%',
}));

const TABS = [
  { path: 'vocabulary', label: 'Vocabulary' },
  { path: 'declensions', label: 'Declensions' },
  { path: 'sentences', label: 'Sentences' },
  { path: 'verbs', label: 'Verbs' },
] as const;

export function AdminContentPage() {
  const { isAdmin } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();

  const { systemWords } = useVocabulary();
  const { systemDeclensionCards } = useDeclension();
  const { systemSentences } = useSentences();
  const { verbs } = useConjugation();

  const currentTab = TABS.findIndex((t) => location.pathname.endsWith(t.path));
  const tabIndex = currentTab === -1 ? 0 : currentTab;

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, value: number) => {
      navigate(`/admin/content/${TABS[value].path}`, { replace: true });
    },
    [navigate]
  );

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer>
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label={`Vocabulary (${systemWords.length})`} />
        <Tab label={`Declensions (${systemDeclensionCards.length})`} />
        <Tab label={`Sentences (${systemSentences.length})`} />
        <Tab label={`Verbs (${verbs.length})`} />
      </Tabs>

      <Box sx={{ pt: 1 }}>
        {tabIndex === 0 && <VocabularyTab />}
        {tabIndex === 1 && <DeclensionsTab />}
        {tabIndex === 2 && <SentencesTab />}
        {tabIndex === 3 && <VerbsTab />}
      </Box>
    </PageContainer>
  );
}

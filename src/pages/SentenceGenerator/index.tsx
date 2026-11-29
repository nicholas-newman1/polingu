import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import { styled } from '../../lib/styled';
import { useSentences } from '../../hooks/useReviewData';
import { useAuthContext } from '../../contexts/AuthContext';
import type { CEFRLevel } from '../../types/sentences';
import { GenerateTab } from './GenerateTab';
import { BrowseTab } from './BrowseTab';
import { CurriculumTab } from './CurriculumTab';
import { AddCustomTab } from './AddCustomTab';

const PageContainer = styled(Box)(() => ({
  maxWidth: 900,
  margin: '0 auto',
  width: '100%',
}));

export function SentenceGeneratorPage() {
  const { isAdmin } = useAuthContext();
  const { sentences } = useSentences();

  const [tabIndex, setTabIndex] = useState(0);
  const [pendingGenerate, setPendingGenerate] = useState<{ level: CEFRLevel; tag: string } | null>(
    null
  );

  const handleGenerateFromSuggestion = (level: CEFRLevel, tag: string) => {
    setPendingGenerate({ level, tag });
    setTabIndex(0);
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer>
      <Tabs
        value={tabIndex}
        onChange={(_, value: number) => setTabIndex(value)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Generate" />
        <Tab label={`Browse (${sentences.length})`} />
        <Tab label="Curriculum" />
        <Tab label="Add Custom" />
      </Tabs>

      <Box sx={{ pt: 3 }}>
        {tabIndex === 0 && (
          <GenerateTab
            key={pendingGenerate ? `${pendingGenerate.level}-${pendingGenerate.tag}` : 'default'}
            initialLevel={pendingGenerate?.level}
            initialTag={pendingGenerate?.tag}
          />
        )}
        {tabIndex === 1 && <BrowseTab />}
        {tabIndex === 2 && (
          <CurriculumTab onGenerateFromSuggestion={handleGenerateFromSuggestion} />
        )}
        {tabIndex === 3 && <AddCustomTab />}
      </Box>
    </PageContainer>
  );
}

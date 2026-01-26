import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import { styled } from '../../lib/styled';
import { useReviewData } from '../../hooks/useReviewData';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useAuthContext } from '../../hooks/useAuthContext';
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
  const { sentences, setSentences, sentenceTags, addSentenceTag } = useReviewData();
  const { showSnackbar } = useSnackbar();

  const [tabIndex, setTabIndex] = useState(0);
  const [pendingGenerate, setPendingGenerate] = useState<{ level: CEFRLevel; tag: string } | null>(null);

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: number) => {
    setTabIndex(value);
  }, []);

  const handleGenerateFromSuggestion = useCallback((level: CEFRLevel, tag: string) => {
    setPendingGenerate({ level, tag });
    setTabIndex(0);
  }, []);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer>
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Generate" />
        <Tab label={`Browse (${sentences.length})`} />
        <Tab label="Curriculum" />
        <Tab label="Add Custom" />
      </Tabs>

      {tabIndex === 0 && (
        <Box sx={{ pt: 3 }}>
          <GenerateTab
            key={pendingGenerate ? `${pendingGenerate.level}-${pendingGenerate.tag}` : 'default'}
            sentences={sentences}
            setSentences={setSentences}
            sentenceTags={sentenceTags}
            addSentenceTag={addSentenceTag}
            showSnackbar={showSnackbar}
          />
        </Box>
      )}

      {tabIndex === 1 && (
        <Box sx={{ pt: 3 }}>
          <BrowseTab
            sentences={sentences}
            setSentences={setSentences}
            sentenceTags={sentenceTags}
            showSnackbar={showSnackbar}
          />
        </Box>
      )}

      {tabIndex === 2 && (
        <Box sx={{ pt: 3 }}>
          <CurriculumTab
            sentenceTags={sentenceTags}
            addSentenceTag={addSentenceTag}
            showSnackbar={showSnackbar}
            onGenerateFromSuggestion={handleGenerateFromSuggestion}
          />
        </Box>
      )}

      {tabIndex === 3 && (
        <Box sx={{ pt: 3 }}>
          <AddCustomTab
            sentences={sentences}
            setSentences={setSentences}
            sentenceTags={sentenceTags}
            showSnackbar={showSnackbar}
          />
        </Box>
      )}
    </PageContainer>
  );
}


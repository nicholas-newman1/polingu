import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { styled } from '../../lib/styled';
import {
  useDeclension,
  useReviewDataLoading,
  useSentences,
  useVocabulary,
} from '../../hooks/useReviewData';
import { useListening } from '../../contexts/ListeningContext';
import { useUserDoc } from '../../hooks/useUserDoc';
import { ListeningSettingsPanel } from '../../components/ListeningSettingsPanel';
import { ToggleLevelChip } from '../../components/LevelChip';
import type { TranslationDirection } from '../../types/common';
import type {
  ListeningFeature,
  ListeningHubSelections,
  ListeningOrdering,
} from '../../types/listening';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import {
  buildSentenceListeningQueue,
  buildVocabularyListeningQueue,
  buildDeclensionListeningQueue,
} from '../../lib/listeningScheduler';
import { listeningHubSelectionsDoc } from '../../lib/storage/userDocs';
import { alpha } from '../../lib/theme';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  maxWidth: 720,
  margin: '0 auto',
  width: '100%',
}));

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}));

const StartButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 600,
  backgroundColor: theme.palette.success.main,
  color: theme.palette.common.white,
  '&:hover': {
    backgroundColor: theme.palette.success.dark,
  },
  '&.Mui-disabled': {
    backgroundColor: alpha(theme.palette.success.main, 0.3),
    color: alpha(theme.palette.common.white, 0.7),
  },
}));

const ORDERING_LABELS: Record<ListeningOrdering, string> = {
  random: 'Random shuffle',
  due: 'Due first',
  'practice-ahead': 'Practice ahead',
  learned: 'Learned cards only',
  'recently-added': 'Recently added',
};

const FEATURE_LABELS: Record<ListeningFeature, string> = {
  sentences: 'Sentences',
  vocabulary: 'Vocabulary',
  declension: 'Declension',
};

export function ListeningHubPage() {
  const navigate = useNavigate();
  const loading = useReviewDataLoading();
  const {
    sentences,
    progress: { stores: sentenceReviewStores },
  } = useSentences();
  const {
    words: vocabularyWords,
    progress: { stores: vocabularyReviewStores },
  } = useVocabulary();
  const {
    cards: declensionCards,
    progress: {
      stores: { all: declensionReviewStore },
    },
  } = useDeclension();

  const { settings, settingsLoading, updateSettings, start } = useListening();
  const {
    value: hubSelections,
    loading: hubSelectionsLoading,
    update: saveHubSelections,
  } = useUserDoc(listeningHubSelectionsDoc);

  const { feature, direction, selectedLevels } = hubSelections;

  const persistSelections = (updates: Partial<ListeningHubSelections>) => {
    void saveHubSelections({ ...hubSelections, ...updates });
  };

  const toggleLevel = (level: CEFRLevel) => {
    const nextLevels = selectedLevels.includes(level)
      ? selectedLevels.filter((l) => l !== level)
      : [...selectedLevels, level];
    persistSelections({ selectedLevels: nextLevels });
  };

  const handleFeatureChange = (e: SelectChangeEvent<ListeningFeature>) => {
    persistSelections({ feature: e.target.value as ListeningFeature });
  };

  const handleOrderingChange = (e: SelectChangeEvent<ListeningOrdering>) => {
    void updateSettings({ ordering: e.target.value as ListeningOrdering });
  };

  const handleDirectionChange = (e: SelectChangeEvent<TranslationDirection>) => {
    persistSelections({ direction: e.target.value as TranslationDirection });
  };

  const queue = useMemo(() => {
    if (loading || settingsLoading || hubSelectionsLoading) return [];
    if (feature === 'sentences') {
      return buildSentenceListeningQueue({
        sentences,
        reviewStore: sentenceReviewStores[direction],
        ordering: settings.ordering,
        levels: selectedLevels,
      });
    }
    if (feature === 'vocabulary') {
      return buildVocabularyListeningQueue({
        words: vocabularyWords,
        reviewStore: vocabularyReviewStores[direction],
        ordering: settings.ordering,
      });
    }
    return buildDeclensionListeningQueue({
      cards: declensionCards,
      reviewStore: declensionReviewStore,
      ordering: settings.ordering,
    });
  }, [
    loading,
    settingsLoading,
    hubSelectionsLoading,
    feature,
    direction,
    selectedLevels,
    settings.ordering,
    sentences,
    sentenceReviewStores,
    vocabularyWords,
    vocabularyReviewStores,
    declensionCards,
    declensionReviewStore,
  ]);

  const previewCount = queue.length;

  const handleStart = () => {
    if (queue.length === 0) return;
    start(queue, {
      meta: {
        feature,
        title: FEATURE_LABELS[feature],
        subtitle: ORDERING_LABELS[settings.ordering],
      },
    });
    navigate('/listen/play');
  };

  const showDirection = feature === 'sentences' || feature === 'vocabulary';
  const showLevels = feature === 'sentences';

  return (
    <PageContainer data-qa="listening-hub-page">
      <Stack direction="row" spacing={1.5} alignItems="center">
        <HeadphonesIcon color="success" />
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Listening mode
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Listen to your cards hands-free. Listening doesn't change your review schedule.
          </Typography>
        </Box>
      </Stack>

      <Section>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          Source
        </Typography>
        <Stack spacing={1.5}>
          <FormControl fullWidth size="small">
            <InputLabel id="feature-label">Feature</InputLabel>
            <Select<ListeningFeature>
              labelId="feature-label"
              label="Feature"
              value={feature}
              onChange={handleFeatureChange}
              data-qa="feature-select"
            >
              {(['sentences', 'vocabulary', 'declension'] as ListeningFeature[]).map((f) => (
                <MenuItem key={f} value={f}>
                  {FEATURE_LABELS[f]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {showDirection && (
            <FormControl fullWidth size="small">
              <InputLabel id="direction-label">Review store</InputLabel>
              <Select<TranslationDirection>
                labelId="direction-label"
                label="Review store"
                value={direction}
                onChange={handleDirectionChange}
                data-qa="direction-select"
              >
                <MenuItem value="pl-to-en">Recognition (PL → EN)</MenuItem>
                <MenuItem value="en-to-pl">Production (EN → PL)</MenuItem>
              </Select>
            </FormControl>
          )}

          {showLevels && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Levels
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {ALL_LEVELS.map((level) => (
                  <ToggleLevelChip
                    key={level}
                    label={level}
                    $level={level}
                    $active={selectedLevels.includes(level)}
                    onClick={() => toggleLevel(level)}
                    data-qa={`level-chip-${level}`}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Section>

      <Section>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          Ordering
        </Typography>
        <FormControl fullWidth size="small">
          <Select<ListeningOrdering>
            value={settings.ordering}
            onChange={handleOrderingChange}
            data-qa="ordering-select"
          >
            {(Object.keys(ORDERING_LABELS) as ListeningOrdering[]).map((opt) => (
              <MenuItem key={opt} value={opt}>
                {ORDERING_LABELS[opt]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Section>

      <ListeningSettingsPanel
        settings={settings}
        onChange={(updates) => {
          void updateSettings(updates);
        }}
      />

      {previewCount === 0 && !loading && !settingsLoading && !hubSelectionsLoading ? (
        <Alert severity="info" data-qa="empty-preview">
          No cards with audio match the current selection.
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {previewCount} {previewCount === 1 ? 'card' : 'cards'} ready
        </Typography>
      )}

      <StartButton
        variant="contained"
        fullWidth
        onClick={handleStart}
        disabled={loading || settingsLoading || hubSelectionsLoading || previewCount === 0}
        data-qa="start-listening"
      >
        Start listening
      </StartButton>
    </PageContainer>
  );
}

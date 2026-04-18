import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useReviewData } from '../../hooks/useReviewData';
import { useListening } from '../../contexts/ListeningContext';
import { useAuthContext } from '../../hooks/useAuthContext';
import { ListeningSettingsPanel } from '../../components/ListeningSettingsPanel';
import type { TranslationDirection } from '../../types/common';
import type {
  ListeningFeature,
  ListeningHubSelections,
  ListeningOrdering,
} from '../../types/listening';
import { DEFAULT_LISTENING_HUB_SELECTIONS } from '../../types/listening';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import {
  buildSentenceListeningQueue,
  buildVocabularyListeningQueue,
  buildDeclensionListeningQueue,
} from '../../lib/listeningScheduler';
import { loadListeningHubSelections } from '../../lib/storage/loadListeningHubSelections';
import saveListeningHubSelections from '../../lib/storage/saveListeningHubSelections';
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

const LevelChip = styled(Chip)<{ $level: CEFRLevel; $active?: boolean }>(
  ({ theme, $level, $active = true }) => ({
    backgroundColor: $active ? theme.palette.levels[$level] : theme.palette.neutral.main,
    color: theme.palette.common.white,
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: $active ? theme.palette.levels[$level] : theme.palette.neutral.dark,
    },
  })
);

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
  const {
    loading,
    sentences,
    sentenceReviewStores,
    vocabularyWords,
    vocabularyReviewStores,
    declensionCards,
    declensionReviewStore,
  } = useReviewData();

  const { settings, settingsLoading, updateSettings, start } = useListening();
  const { user } = useAuthContext();

  const [hubSelections, setHubSelections] = useState<ListeningHubSelections>(
    DEFAULT_LISTENING_HUB_SELECTIONS
  );
  const [hubSelectionsLoaded, setHubSelectionsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      loadListeningHubSelections().then((loaded) => {
        if (!cancelled) {
          setHubSelections(loaded);
          setHubSelectionsLoaded(true);
        }
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setHubSelections(DEFAULT_LISTENING_HUB_SELECTIONS);
          setHubSelectionsLoaded(true);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const { feature, direction, selectedLevels } = hubSelections;

  const persistSelections = (updates: Partial<ListeningHubSelections>) => {
    setHubSelections((prev) => {
      const next = { ...prev, ...updates };
      void saveListeningHubSelections(next);
      return next;
    });
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

  const previewCount = useMemo(() => {
    if (loading || settingsLoading || !hubSelectionsLoaded) return 0;
    if (feature === 'sentences') {
      return buildSentenceListeningQueue({
        sentences,
        reviewStore: sentenceReviewStores[direction],
        ordering: settings.ordering,
        levels: selectedLevels,
      }).length;
    }
    if (feature === 'vocabulary') {
      return buildVocabularyListeningQueue({
        words: vocabularyWords,
        reviewStore: vocabularyReviewStores[direction],
        ordering: settings.ordering,
      }).length;
    }
    return buildDeclensionListeningQueue({
      cards: declensionCards,
      reviewStore: declensionReviewStore,
      ordering: settings.ordering,
    }).length;
  }, [
    loading,
    settingsLoading,
    hubSelectionsLoaded,
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

  const handleStart = () => {
    if (previewCount === 0) return;
    let queue;
    let subtitle = '';
    if (feature === 'sentences') {
      queue = buildSentenceListeningQueue({
        sentences,
        reviewStore: sentenceReviewStores[direction],
        ordering: settings.ordering,
        levels: selectedLevels,
      });
      subtitle = `${ORDERING_LABELS[settings.ordering]}`;
    } else if (feature === 'vocabulary') {
      queue = buildVocabularyListeningQueue({
        words: vocabularyWords,
        reviewStore: vocabularyReviewStores[direction],
        ordering: settings.ordering,
      });
      subtitle = `${ORDERING_LABELS[settings.ordering]}`;
    } else {
      queue = buildDeclensionListeningQueue({
        cards: declensionCards,
        reviewStore: declensionReviewStore,
        ordering: settings.ordering,
      });
      subtitle = `${ORDERING_LABELS[settings.ordering]}`;
    }
    if (queue.length === 0) return;
    start(queue, {
      meta: {
        feature,
        title: FEATURE_LABELS[feature],
        subtitle,
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
            Passive audio practice. No FSRS writes.
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
                  <LevelChip
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

      {previewCount === 0 && !loading && !settingsLoading && hubSelectionsLoaded ? (
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
        disabled={loading || settingsLoading || !hubSelectionsLoaded || previewCount === 0}
        data-qa="start-listening"
      >
        Start listening
      </StartButton>
    </PageContainer>
  );
}

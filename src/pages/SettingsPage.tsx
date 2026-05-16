import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Typography,
  Button,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  VolumeUp,
  CloudDownload,
  DeleteOutline,
  CloudOff,
  VisibilityOff,
} from '@mui/icons-material';
import { styled } from '../lib/styled';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useReviewData } from '../hooks/useReviewData';
import {
  preloadAudioFiles,
  getAudioCacheCount,
  clearAudioCache,
  formatCacheSize,
  getAudioCacheSize,
  type PreloadProgress,
} from '../lib/audioPreloader';
import type { Verb } from '../types/conjugation';

const PageContainer = styled(Box)(({ theme }) => ({
  maxWidth: 600,
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const SettingCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const SettingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 0),
}));

const SettingInfo = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const SettingIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: 8,
}));

const StatsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  flexWrap: 'wrap',
}));

// Helper to extract all audio URLs from verbs (infinitive + all conjugation forms)
function getVerbAudioUrls(verbs: Verb[]): Array<{ audioUrl?: string }> {
  const items: Array<{ audioUrl?: string }> = [];

  for (const verb of verbs) {
    // Infinitive audio
    if (verb.infinitiveAudioUrl) {
      items.push({ audioUrl: verb.infinitiveAudioUrl });
    }

    // All conjugation form audio
    const tenses = ['present', 'past', 'future', 'imperative', 'conditional'] as const;
    for (const tense of tenses) {
      const forms = verb.conjugations[tense];
      if (forms) {
        for (const form of Object.values(forms)) {
          if (form?.audioUrl) {
            items.push({ audioUrl: form.audioUrl });
          }
        }
      }
    }
  }

  return items;
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings();
  const { systemSentences, systemWords, systemDeclensionCards, verbs } = useReviewData();

  // Offline audio state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<PreloadProgress | null>(null);
  const [cacheCount, setCacheCount] = useState(0);
  const [cacheSize, setCacheSize] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  // Calculate total audio items
  const allAudioItems = useMemo(() => {
    const items: Array<{ audioUrl?: string }> = [
      ...systemSentences,
      ...systemWords,
      ...systemDeclensionCards,
      ...getVerbAudioUrls(verbs),
    ];
    return items.filter((item) => item.audioUrl);
  }, [systemSentences, systemWords, systemDeclensionCards, verbs]);

  // Load cache stats on mount
  const refreshCacheStats = useCallback(async () => {
    const [count, size] = await Promise.all([getAudioCacheCount(), getAudioCacheSize()]);
    setCacheCount(count);
    setCacheSize(size);
  }, []);

  useEffect(() => {
    refreshCacheStats();
  }, [refreshCacheStats]);

  const handleAutoPlayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ autoPlayAudio: event.target.checked });
  };

  const handleHidePolishChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ hidePolishText: event.target.checked });
  };

  const handleDownloadAudio = async () => {
    if (isDownloading || !navigator.onLine) return;

    setIsDownloading(true);
    setDownloadProgress({ loaded: 0, total: allAudioItems.length, failed: 0 });

    try {
      await preloadAudioFiles(allAudioItems, (progress) => {
        setDownloadProgress(progress);
      });
      await refreshCacheStats();
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await clearAudioCache();
      await refreshCacheStats();
    } finally {
      setIsClearing(false);
    }
  };

  const progressPercent = downloadProgress
    ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
    : 0;

  return (
    <PageContainer>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <SettingCard>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Audio
          </Typography>

          <SettingRow>
            <SettingInfo>
              <SettingIcon>
                <VolumeUp />
              </SettingIcon>
              <Box>
                <Typography variant="body1">Auto-play audio</Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatically play audio when a flashcard opens
                </Typography>
              </Box>
            </SettingInfo>
            <FormControlLabel
              control={<Switch checked={settings.autoPlayAudio} onChange={handleAutoPlayChange} />}
              label=""
            />
          </SettingRow>

          <SettingRow>
            <SettingInfo>
              <SettingIcon>
                <VisibilityOff />
              </SettingIcon>
              <Box>
                <Typography variant="body1">Hide Polish text</Typography>
                <Typography variant="body2" color="text.secondary">
                  Hide Polish text on flashcards to focus on learning by audio
                </Typography>
              </Box>
            </SettingInfo>
            <FormControlLabel
              control={
                <Switch checked={settings.hidePolishText} onChange={handleHidePolishChange} />
              }
              label=""
            />
          </SettingRow>
        </CardContent>
      </SettingCard>

      <SettingCard>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Offline Audio
          </Typography>

          <SettingRow>
            <SettingInfo>
              <SettingIcon>
                <CloudDownload />
              </SettingIcon>
              <Box>
                <Typography variant="body1">Download audio for offline use</Typography>
                <Typography variant="body2" color="text.secondary">
                  Pre-download all audio files so they work without internet
                </Typography>
              </Box>
            </SettingInfo>
          </SettingRow>

          <StatsRow>
            <Chip label={`${cacheCount} files cached`} size="small" variant="outlined" />
            {cacheSize > 0 && (
              <Chip label={formatCacheSize(cacheSize)} size="small" variant="outlined" />
            )}
            <Chip
              label={`${allAudioItems.length} total audio files`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </StatsRow>

          {isDownloading && downloadProgress && (
            <ProgressContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Downloading: {downloadProgress.loaded} / {downloadProgress.total}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {progressPercent}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progressPercent} />
              {downloadProgress.failed > 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {downloadProgress.failed} files failed to download
                </Typography>
              )}
            </ProgressContainer>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              startIcon={isDownloading ? null : <CloudDownload />}
              onClick={handleDownloadAudio}
              disabled={isDownloading || !navigator.onLine}
            >
              {isDownloading ? 'Downloading...' : 'Download All Audio'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={handleClearCache}
              disabled={isClearing || cacheCount === 0}
            >
              {isClearing ? 'Clearing...' : 'Clear Cache'}
            </Button>
          </Box>

          {!navigator.onLine && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CloudOff color="warning" fontSize="small" />
              <Typography variant="body2" color="warning.main">
                You're offline. Connect to download audio.
              </Typography>
            </Box>
          )}
        </CardContent>
      </SettingCard>
    </PageContainer>
  );
}

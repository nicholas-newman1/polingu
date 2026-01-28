import { Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import type { User } from 'firebase/auth';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { NumberInput } from './NumberInput';
import type { CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';

const SettingsCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  maxWidth: 420,
  margin: '0 auto',
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
}));

const ResetButton = styled(Button)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
  },
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

interface SentenceSettingsPanelProps {
  newCardsPerDay: number;
  selectedLevels: CEFRLevel[];
  user: User | null;
  onNewCardsChange: (newCardsPerDay: number) => void;
  onLevelsChange: (levels: CEFRLevel[]) => void;
  onResetAllData: () => void;
  resetButtonLabel?: string;
  practiceMode?: boolean;
}

export function SentenceSettingsPanel({
  newCardsPerDay,
  selectedLevels,
  user,
  onNewCardsChange,
  onLevelsChange,
  onResetAllData,
  resetButtonLabel = 'Reset All Progress',
  practiceMode = false,
}: SentenceSettingsPanelProps) {
  const handleToggleLevel = (level: CEFRLevel) => {
    if (selectedLevels.includes(level)) {
      if (selectedLevels.length === 1) return;
      onLevelsChange(selectedLevels.filter((l) => l !== level));
    } else {
      onLevelsChange([...selectedLevels, level]);
    }
  };

  return (
    <SettingsCard className="animate-fade-up">
      <Typography variant="h6" sx={{ mb: 2 }}>
        {practiceMode ? 'Filters' : 'Settings'}
      </Typography>

      {!practiceMode && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            New cards per day
          </Typography>
          <NumberInput value={newCardsPerDay} onChange={onNewCardsChange} min={1} />
        </Stack>
      )}

      <Box sx={{ mb: practiceMode ? 0 : 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Difficulty levels
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {ALL_LEVELS.map((level) => (
            <LevelChip
              key={level}
              $level={level}
              label={level}
              $active={selectedLevels.includes(level)}
              onClick={() => handleToggleLevel(level)}
            />
          ))}
        </Stack>
      </Box>

      {!practiceMode && user && (
        <>
          <Divider sx={{ my: 2 }} />
          <ResetButton fullWidth variant="contained" onClick={onResetAllData}>
            {resetButtonLabel}
          </ResetButton>
        </>
      )}
    </SettingsCard>
  );
}

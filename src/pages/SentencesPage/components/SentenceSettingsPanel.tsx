import { Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import type { User } from 'firebase/auth';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
import { NumberInput } from '../../../components/NumberInput';
import type { CEFRLevel } from '../../../types/sentences';

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

export const LevelChip = styled(Chip)<{ $level: CEFRLevel; $active?: boolean }>(
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
  user: User | null;
  onNewCardsChange: (newCardsPerDay: number) => void;
  onResetAllData: () => void;
  resetButtonLabel?: string;
}

export function SentenceSettingsPanel({
  newCardsPerDay,
  user,
  onNewCardsChange,
  onResetAllData,
  resetButtonLabel = 'Reset All Progress',
}: SentenceSettingsPanelProps) {
  return (
    <SettingsCard className="animate-fade-up">
      <Typography variant="h6" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          New cards per day
        </Typography>
        <NumberInput value={newCardsPerDay} onChange={onNewCardsChange} min={1} />
      </Stack>

      {user && (
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

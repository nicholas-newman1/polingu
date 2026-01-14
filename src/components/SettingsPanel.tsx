import {
  Button,
  Card,
  Divider,
  Stack,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import type { User } from 'firebase/auth';

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

const NumberInput = styled(TextField)({
  width: 80,
  '& input': {
    fontFamily: '"JetBrains Mono", monospace',
    textAlign: 'center',
  },
});

const ResetButton = styled(Button)(({ theme }) => ({
  backgroundColor: 'rgba(194, 58, 34, 0.1)',
  color: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: 'rgba(194, 58, 34, 0.2)',
  },
}));

interface SettingsPanelProps {
  newCardsPerDay: number;
  user: User | null;
  onSettingsChange: (newCardsPerDay: number) => void;
  onResetAllData: () => void;
  resetButtonLabel?: string;
}

export function SettingsPanel({
  newCardsPerDay,
  user,
  onSettingsChange,
  onResetAllData,
  resetButtonLabel = 'Reset All Progress',
}: SettingsPanelProps) {
  return (
    <SettingsCard className="animate-fade-up">
      <Typography variant="h6" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          New cards per day
        </Typography>
        <NumberInput
          type="number"
          size="small"
          value={newCardsPerDay}
          onChange={(e) =>
            onSettingsChange(Math.max(1, parseInt(e.target.value) || 1))
          }
          inputProps={{ min: 1, max: 100 }}
        />
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

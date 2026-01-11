import {
  Avatar,
  Box,
  Button,
  Card,
  Paper,
  Stack,
  TextField,
  Typography,
  styled,
} from '@mui/material';

const CardWrapper = styled(Box)({
  width: '100%',
  maxWidth: 420,
  margin: '0 auto',
});

const CardGlow = styled(Box)({
  position: 'absolute',
  inset: -12,
  borderRadius: 16,
  filter: 'blur(24px)',
  opacity: 0.2,
});

const SuccessCardGlow = styled(CardGlow)({
  background: 'linear-gradient(135deg, #2d6a4f, #c9a227, #2d6a4f)',
});

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(3),
  backgroundColor: 'rgba(255,255,255,0.95)',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
}));

const CelebrationAvatar = styled(Avatar)(({ theme }) => ({
  width: 64,
  height: 64,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(135deg, #2d6a4f, #1b4332)',
  fontSize: '2rem',
  boxShadow: theme.shadows[3],
}));

const SuccessButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.success.main,
  '&:hover': {
    backgroundColor: theme.palette.success.dark,
  },
}));

const WarningButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.warning.main,
  '&:hover': {
    backgroundColor: theme.palette.warning.dark,
  },
}));

const OptionPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

const SmallNumberInput = styled(TextField)({
  width: 72,
  '& input': {
    fontFamily: '"JetBrains Mono", monospace',
    textAlign: 'center',
  },
});

interface FinishedStateProps {
  practiceAheadCount: number;
  setPracticeAheadCount: (count: number) => void;
  extraNewCardsCount: number;
  setExtraNewCardsCount: (count: number) => void;
  onPracticeAhead: () => void;
  onLearnExtra: () => void;
}

export function FinishedState({
  practiceAheadCount,
  setPracticeAheadCount,
  extraNewCardsCount,
  setExtraNewCardsCount,
  onPracticeAhead,
  onLearnExtra,
}: FinishedStateProps) {
  return (
    <CardWrapper className="animate-fade-up">
      <Box sx={{ position: 'relative' }}>
        <SuccessCardGlow className="card-glow" />
        <StyledCard>
          <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
            <CelebrationAvatar>🎉</CelebrationAvatar>
            <Typography variant="h4" sx={{ fontWeight: 300, mb: 1 }}>
              Done for today!
            </Typography>
            <Typography variant="body1" color="text.disabled">
              Come back tomorrow for more practice
            </Typography>
          </Box>

          <Stack spacing={2}>
            <OptionPaper elevation={0}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color="text.secondary"
                >
                  Learn extra new
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SmallNumberInput
                    type="number"
                    size="small"
                    value={extraNewCardsCount || ''}
                    onChange={(e) =>
                      setExtraNewCardsCount(parseInt(e.target.value) || 0)
                    }
                    onBlur={() => {
                      if (extraNewCardsCount < 1) setExtraNewCardsCount(1);
                    }}
                    inputProps={{ min: 1, max: 50 }}
                  />
                  <Typography variant="body2" color="text.disabled">
                    cards
                  </Typography>
                </Stack>
              </Stack>
              <WarningButton
                fullWidth
                size="large"
                variant="contained"
                onClick={onLearnExtra}
              >
                Learn New Cards
              </WarningButton>
            </OptionPaper>

            <OptionPaper elevation={0}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color="text.secondary"
                >
                  Practice ahead
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SmallNumberInput
                    type="number"
                    size="small"
                    value={practiceAheadCount || ''}
                    onChange={(e) =>
                      setPracticeAheadCount(parseInt(e.target.value) || 0)
                    }
                    onBlur={() => {
                      if (practiceAheadCount < 1) setPracticeAheadCount(1);
                    }}
                    inputProps={{ min: 1, max: 100 }}
                  />
                  <Typography variant="body2" color="text.disabled">
                    cards
                  </Typography>
                </Stack>
              </Stack>
              <SuccessButton
                fullWidth
                size="large"
                variant="contained"
                onClick={onPracticeAhead}
              >
                Start Practice Ahead
              </SuccessButton>
            </OptionPaper>
          </Stack>
        </StyledCard>
      </Box>
    </CardWrapper>
  );
}

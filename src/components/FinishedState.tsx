import {
  Avatar,
  Box,
  Button,
  Card,
  Paper,
  Stack,
  Tooltip,
  Typography,
  styled,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { alpha } from '../lib/theme';
import { NumberInput } from './NumberInput';

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

const SuccessCardGlow = styled(CardGlow)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.secondary.main}, ${theme.palette.success.main})`,
}));

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(3),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
}));

const CelebrationAvatar = styled(Avatar)(({ theme }) => ({
  width: 64,
  height: 64,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
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
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" fontWeight={500} color="text.secondary">
                    Add new cards
                  </Typography>
                  <Tooltip
                    title="Learn cards you haven't seen yet. These will be added to your daily reviews."
                    arrow
                    placement="top"
                  >
                    <HelpOutlineIcon
                      sx={{
                        fontSize: 16,
                        color: 'text.disabled',
                        cursor: 'help',
                      }}
                    />
                  </Tooltip>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <NumberInput
                    value={extraNewCardsCount}
                    onChange={setExtraNewCardsCount}
                    min={1}
                    width={72}
                  />
                  <Typography variant="body2" color="text.disabled">
                    cards
                  </Typography>
                </Stack>
              </Stack>
              <SuccessButton fullWidth size="large" variant="contained" onClick={onLearnExtra}>
                Start New Cards
              </SuccessButton>
            </OptionPaper>

            <OptionPaper elevation={0}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" fontWeight={500} color="text.secondary">
                    Review early
                  </Typography>
                  <Tooltip
                    title="Review cards before they're due. Great for extra practice or if you'll be away."
                    arrow
                    placement="top"
                  >
                    <HelpOutlineIcon
                      sx={{
                        fontSize: 16,
                        color: 'text.disabled',
                        cursor: 'help',
                      }}
                    />
                  </Tooltip>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <NumberInput
                    value={practiceAheadCount}
                    onChange={setPracticeAheadCount}
                    min={1}
                    width={72}
                  />
                  <Typography variant="body2" color="text.disabled">
                    cards
                  </Typography>
                </Stack>
              </Stack>
              <WarningButton fullWidth size="large" variant="contained" onClick={onPracticeAhead}>
                Start Early Review
              </WarningButton>
            </OptionPaper>
          </Stack>
        </StyledCard>
      </Box>
    </CardWrapper>
  );
}

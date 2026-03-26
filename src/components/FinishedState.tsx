import {
  Avatar,
  Box,
  Button,
  Card,
  Divider,
  IconButton,
  Stack,
  Typography,
  styled,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { alpha } from '../lib/theme';

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
  width: 56,
  height: 56,
  margin: '0 auto',
  marginBottom: theme.spacing(1.5),
  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
  fontSize: '1.75rem',
  boxShadow: theme.shadows[3],
}));

const DirectionButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const FeatureButton = styled(Button)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
  },
}));

const ActionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.25, 1.5),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: alpha(theme.palette.background.default, 0.6),
  border: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
  gap: theme.spacing(1),
  transition: 'border-color 0.2s',
  '&:hover': {
    borderColor: alpha(theme.palette.divider, 0.5),
  },
}));

const StepperButton = styled(IconButton)(({ theme }) => ({
  width: 28,
  height: 28,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.action.active, 0.06),
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.active, 0.14),
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
  },
}));

const GoButton = styled(IconButton)(({ theme }) => ({
  width: 34,
  height: 34,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
  },
  '& .MuiSvgIcon-root': {
    fontSize: '1.25rem',
  },
}));

const CountBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  padding: '0 6px',
  borderRadius: 10,
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: alpha(theme.palette.common.white, 0.2),
  marginLeft: theme.spacing(1),
}));

const FeatureCountBadge = styled(CountBadge)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
  color: theme.palette.primary.main,
}));

export type FeatureType = 'vocabulary' | 'sentences' | 'conjugation' | 'declension' | 'aspectPairs';
export type Direction = 'pl-to-en' | 'en-to-pl';

interface OtherFeatureDue {
  feature: FeatureType;
  label: string;
  dueCount: number;
  path: string;
}

interface FinishedStateProps {
  // Current feature context
  currentFeature: FeatureType;
  currentDirection?: Direction;

  // Other direction info (for features with directions)
  otherDirectionDueCount?: number;
  otherDirectionLabel?: string;
  onSwitchDirection?: () => void;

  // Other features with due cards
  otherFeaturesDue: OtherFeatureDue[];
  onNavigateToFeature: (path: string) => void;

  // Existing practice ahead / learn extra functionality
  practiceAheadCount: number;
  setPracticeAheadCount: (count: number) => void;
  extraNewCardsCount: number;
  setExtraNewCardsCount: (count: number) => void;
  onPracticeAhead: () => void;
  onLearnExtra: () => void;
}

export function FinishedState({
  otherDirectionDueCount,
  otherDirectionLabel,
  onSwitchDirection,
  otherFeaturesDue,
  onNavigateToFeature,
  practiceAheadCount,
  setPracticeAheadCount,
  extraNewCardsCount,
  setExtraNewCardsCount,
  onPracticeAhead,
  onLearnExtra,
}: FinishedStateProps) {
  const hasOtherDirection = otherDirectionDueCount !== undefined && otherDirectionDueCount > 0;
  const featuresWithDue = otherFeaturesDue.filter((f) => f.dueCount > 0).slice(0, 2);
  const hasOtherFeatures = featuresWithDue.length > 0;
  const hasNextActions = hasOtherDirection || hasOtherFeatures;

  return (
    <CardWrapper className="animate-fade-up">
      <Box sx={{ position: 'relative' }}>
        <SuccessCardGlow className="card-glow" />
        <StyledCard>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CelebrationAvatar>🎉</CelebrationAvatar>
            <Typography variant="h5" sx={{ fontWeight: 400, mb: 0.5 }}>
              {hasNextActions ? "What's next?" : 'All done!'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {hasNextActions
                ? 'You finished this section'
                : 'Come back tomorrow for more drills'}
            </Typography>
          </Box>

          {/* Primary CTA: Switch direction */}
          {hasOtherDirection && onSwitchDirection && (
            <DirectionButton
              fullWidth
              size="large"
              variant="contained"
              startIcon={<SwapHorizIcon />}
              onClick={onSwitchDirection}
              sx={{ mb: 2 }}
            >
              Switch to {otherDirectionLabel}
              <CountBadge>{otherDirectionDueCount}</CountBadge>
            </DirectionButton>
          )}

          {/* Secondary CTAs: Other features */}
          {hasOtherFeatures && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: hasNextActions ? 2 : 0, flexWrap: 'wrap', gap: 1 }}
            >
              {featuresWithDue.map((feature) => (
                <FeatureButton
                  key={feature.feature}
                  variant="contained"
                  size="medium"
                  onClick={() => onNavigateToFeature(feature.path)}
                  disableElevation
                >
                  {feature.label}
                  <FeatureCountBadge>{feature.dueCount}</FeatureCountBadge>
                </FeatureButton>
              ))}
            </Stack>
          )}

          {/* Divider before tertiary options */}
          {hasNextActions && (
            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" color="text.disabled">
                or stay here
              </Typography>
            </Divider>
          )}

          {/* Actions: learn new / review early */}
          <Stack spacing={1}>
            <ActionRow>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  Learn new
                </Typography>
                <Typography variant="caption" color="text.disabled" noWrap>
                  Cards you haven't seen
                </Typography>
              </Box>
              <StepperButton
                size="small"
                onClick={() => setExtraNewCardsCount(Math.max(1, extraNewCardsCount - 1))}
                disabled={extraNewCardsCount <= 1}
              >
                <RemoveIcon />
              </StepperButton>
              <Typography
                variant="body2"
                sx={{
                  minWidth: 26,
                  textAlign: 'center',
                  fontWeight: 600,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.85rem',
                }}
              >
                {extraNewCardsCount}
              </Typography>
              <StepperButton size="small" onClick={() => setExtraNewCardsCount(extraNewCardsCount + 1)}>
                <AddIcon />
              </StepperButton>
              <GoButton size="small" onClick={onLearnExtra}>
                <PlayArrowRoundedIcon />
              </GoButton>
            </ActionRow>

            <ActionRow>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  Review early
                </Typography>
                <Typography variant="caption" color="text.disabled" noWrap>
                  Practice before they're due
                </Typography>
              </Box>
              <StepperButton
                size="small"
                onClick={() => setPracticeAheadCount(Math.max(1, practiceAheadCount - 1))}
                disabled={practiceAheadCount <= 1}
              >
                <RemoveIcon />
              </StepperButton>
              <Typography
                variant="body2"
                sx={{
                  minWidth: 26,
                  textAlign: 'center',
                  fontWeight: 600,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.85rem',
                }}
              >
                {practiceAheadCount}
              </Typography>
              <StepperButton size="small" onClick={() => setPracticeAheadCount(practiceAheadCount + 1)}>
                <AddIcon />
              </StepperButton>
              <GoButton size="small" onClick={onPracticeAhead}>
                <PlayArrowRoundedIcon />
              </GoButton>
            </ActionRow>
          </Stack>
        </StyledCard>
      </Box>
    </CardWrapper>
  );
}

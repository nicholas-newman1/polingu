import { Box, Typography, CircularProgress, LinearProgress } from '@mui/material';
import { Visibility, Edit } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { FeatureCard } from './FeatureCard';
import { ReviewCountBadge } from './ReviewCountBadge';
import type { SentenceDirection, CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import type { SentenceDirectionStats } from '../hooks/useProgressStats';

interface SentenceModeSelectorProps {
  stats: Record<SentenceDirection, SentenceDirectionStats>;
  loading?: boolean;
  onSelectMode: (direction: SentenceDirection) => void;
}

const Container = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(3),
  padding: theme.spacing(2),
  width: '100%',
  maxWidth: 640,
  margin: '0 auto',
}));

const Header = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(2),
}));

const ModesGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(2),
  width: '100%',
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
  },
}));

const LevelStatsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  width: '100%',
}));

const LevelRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const LevelLabel = styled(Typography)<{ $level: CEFRLevel }>(({ theme, $level }) => ({
  fontSize: '0.7rem',
  fontWeight: 600,
  width: 24,
  color: theme.palette.levels[$level],
}));

const LevelProgress = styled(LinearProgress)<{ $level: CEFRLevel }>(({ theme, $level }) => ({
  flex: 1,
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.palette.action.hover,
  '& .MuiLinearProgress-bar': {
    backgroundColor: theme.palette.levels[$level],
    borderRadius: 3,
  },
}));

const LevelCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.65rem',
  color: theme.palette.text.secondary,
  minWidth: 36,
  textAlign: 'right',
}));

const MODES: Array<{
  direction: SentenceDirection;
  title: string;
  subtitle: string;
  icon: typeof Visibility;
  colorKey: 'info' | 'success';
}> = [
  {
    direction: 'pl-to-en',
    title: 'Recognition',
    subtitle: 'See Polish → Recall English',
    icon: Visibility,
    colorKey: 'info',
  },
  {
    direction: 'en-to-pl',
    title: 'Production',
    subtitle: 'See English → Produce Polish',
    icon: Edit,
    colorKey: 'success',
  },
];

export function SentenceModeSelector({ stats, loading, onSelectMode }: SentenceModeSelectorProps) {
  if (loading) {
    return (
      <Container sx={{ minHeight: '40vh', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Typography variant="h5" color="text.primary" sx={{ fontWeight: 500, mb: 1 }}>
          Choose Your Practice Mode
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each mode tracks progress independently
        </Typography>
      </Header>

      <ModesGrid>
        {MODES.map((mode) => {
          const modeStats = stats[mode.direction];
          const color = mode.colorKey === 'info' ? '#2a6f97' : '#2d6a4f';

          return (
            <FeatureCard
              key={mode.direction}
              color={color}
              icon={<mode.icon sx={{ fontSize: 28 }} />}
              title={mode.title}
              description={mode.subtitle}
              badge={<ReviewCountBadge count={modeStats.total.due} />}
              onClick={() => onSelectMode(mode.direction)}
              align="center"
            >
              <LevelStatsContainer>
                {ALL_LEVELS.map((level) => {
                  const levelStats = modeStats.byLevel[level];
                  const progress =
                    levelStats.total > 0 ? (levelStats.learned / levelStats.total) * 100 : 0;
                  return (
                    <LevelRow key={level}>
                      <LevelLabel $level={level}>{level}</LevelLabel>
                      <LevelProgress variant="determinate" value={progress} $level={level} />
                      <LevelCount>
                        {levelStats.learned}/{levelStats.total}
                      </LevelCount>
                    </LevelRow>
                  );
                })}
              </LevelStatsContainer>
            </FeatureCard>
          );
        })}
      </ModesGrid>
    </Container>
  );
}

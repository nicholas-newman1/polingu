import { Box, Typography, CircularProgress } from '@mui/material';
import { Visibility, Edit } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { FeatureCard } from './FeatureCard';
import { ProgressStats } from './ProgressStats';
import { ReviewCountBadge } from './ReviewCountBadge';
import type { VocabularyDirection } from '../types/vocabulary';

interface DeckStats {
  dueCount: number;
  learnedCount: number;
  totalCount: number;
}

interface VocabularyModeSelectorProps {
  stats: Record<VocabularyDirection, DeckStats>;
  loading?: boolean;
  onSelectMode: (direction: VocabularyDirection) => void;
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

const MODES: Array<{
  direction: VocabularyDirection;
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

export function VocabularyModeSelector({
  stats,
  loading,
  onSelectMode,
}: VocabularyModeSelectorProps) {
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
        <Typography
          variant="h5"
          color="text.primary"
          sx={{ fontWeight: 500, mb: 1 }}
        >
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
              badge={<ReviewCountBadge count={modeStats.dueCount} />}
              onClick={() => onSelectMode(mode.direction)}
              align="center"
            >
              <ProgressStats
                learned={modeStats.learnedCount}
                total={modeStats.totalCount}
                color={color}
                layout="stacked"
              />
            </FeatureCard>
          );
        })}
      </ModesGrid>
    </Container>
  );
}

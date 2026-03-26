import type { ReactNode } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Visibility, Edit } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { FeatureCard } from './FeatureCard';
import { ProgressStats } from './ProgressStats';
import { ReviewCountBadge } from './ReviewCountBadge';
import type { TranslationDirection } from '../types/common';

export interface DeckStats {
  dueCount: number;
  learnedCount: number;
  totalCount: number;
}

interface ModeConfig {
  direction: TranslationDirection;
  title: string;
  subtitle: string;
  icon: typeof Visibility | typeof Edit;
  color: string;
}

const DEFAULT_MODES: ModeConfig[] = [
  {
    direction: 'pl-to-en',
    title: 'Recognition',
    subtitle: 'See Polish → Recall English',
    icon: Visibility,
    color: '#2a6f97',
  },
  {
    direction: 'en-to-pl',
    title: 'Production',
    subtitle: 'See English → Produce Polish',
    icon: Edit,
    color: '#2d6a4f',
  },
];

export interface ModeSelectorProps {
  stats: Record<TranslationDirection, DeckStats>;
  loading?: boolean;
  onSelectMode: (direction: TranslationDirection) => void;
  renderStats?: (stats: DeckStats, color: string, direction: TranslationDirection) => ReactNode;
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

export function ModeSelector({ stats, loading, onSelectMode, renderStats }: ModeSelectorProps) {
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
          Choose Your Drill Mode
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each mode tracks progress independently
        </Typography>
      </Header>

      <ModesGrid>
        {DEFAULT_MODES.map((mode) => {
          const modeStats = stats[mode.direction];
          const Icon = mode.icon;

          return (
            <FeatureCard
              key={mode.direction}
              color={mode.color}
              icon={<Icon sx={{ fontSize: 28 }} />}
              title={mode.title}
              description={mode.subtitle}
              badge={<ReviewCountBadge count={modeStats.dueCount} />}
              onClick={() => onSelectMode(mode.direction)}
              align="center"
            >
              {renderStats ? (
                renderStats(modeStats, mode.color, mode.direction)
              ) : (
                <ProgressStats
                  learned={modeStats.learnedCount}
                  total={modeStats.totalCount}
                  color={mode.color}
                  layout="stacked"
                />
              )}
            </FeatureCard>
          );
        })}
      </ModesGrid>
    </Container>
  );
}

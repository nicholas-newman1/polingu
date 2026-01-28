import { useNavigate } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';
import { School, Abc, Translate, AutoStories } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { useReviewData } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';
import { FeatureCard } from '../components/FeatureCard';
import { ProgressStats } from '../components/ProgressStats';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { SITE_NAME } from '../constants';
import { SiteLogo } from '../components/SiteLogo';

type ColorKey = 'primary' | 'info' | 'success' | 'warning';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  minHeight: '60vh',
}));

const Header = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(6),
}));

const Title = styled(Typography)({
  fontWeight: 300,
  letterSpacing: '-0.02em',
});

const CardsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: 960,
}));

type StatsKey = 'declension' | 'vocabulary' | 'sentences' | 'conjugation';

const FEATURES: Array<{
  path: string;
  icon: typeof School;
  title: string;
  description: string;
  colorKey: ColorKey;
  statsKey?: StatsKey;
}> = [
  {
    path: '/declension',
    icon: School,
    title: 'Declension',
    description: 'Practice noun and pronoun declensions with spaced repetition flashcards',
    colorKey: 'primary',
    statsKey: 'declension',
  },
  {
    path: '/vocabulary',
    icon: Abc,
    title: 'Vocabulary',
    description: 'Learn the top 1000 most common Polish words with example sentences',
    colorKey: 'info',
    statsKey: 'vocabulary',
  },
  {
    path: '/sentences',
    icon: Translate,
    title: 'Sentences',
    description: 'Translate full sentences and practice with spaced repetition',
    colorKey: 'success',
    statsKey: 'sentences',
  },
  {
    path: '/conjugation',
    icon: AutoStories,
    title: 'Conjugation',
    description: 'Master Polish verb conjugations across all tenses and persons',
    colorKey: 'warning',
    statsKey: 'conjugation',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { loading } = useReviewData();
  const progressStats = useProgressStats();

  return (
    <PageContainer>
      <Header>
        <Title
          variant="h3"
          color="text.primary"
          sx={{
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: 'center',
          }}
        >
          <SiteLogo size={40} /> {SITE_NAME}
        </Title>
        <Typography variant="body1" color="text.secondary">
          Choose what you'd like to practice today
        </Typography>
      </Header>

      <CardsGrid>
        {FEATURES.map((feature) => {
          const color = theme.palette[feature.colorKey].main;
          const stats = feature.statsKey ? progressStats[feature.statsKey] : undefined;

          return (
            <FeatureCard
              key={feature.path}
              color={color}
              icon={<feature.icon sx={{ fontSize: 28 }} />}
              title={feature.title}
              description={feature.description}
              badge={stats ? <ReviewCountBadge count={stats.due} loading={loading} /> : undefined}
              onClick={() => navigate(feature.path)}
            >
              {stats && (
                <ProgressStats
                  learned={stats.learned}
                  total={stats.total}
                  color={color}
                  layout="inline"
                  loading={loading}
                />
              )}
            </FeatureCard>
          );
        })}
      </CardsGrid>
    </PageContainer>
  );
}

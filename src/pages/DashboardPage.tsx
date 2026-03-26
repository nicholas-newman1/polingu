import { useNavigate } from 'react-router-dom';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '../lib/styled';
import { useReviewData } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';
import { FeatureCard } from '../components/FeatureCard';
import { ProgressStats } from '../components/ProgressStats';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { SITE_NAME } from '../constants';
import { FEATURE_NAV_ITEMS, EXTRA_NAV_ITEMS } from '../constants/navigation';
import { SiteLogo } from '../components/SiteLogo';

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
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(1.5),
  width: '100%',
  maxWidth: 960,
  [theme.breakpoints.up('sm')]: {
    gap: theme.spacing(3),
  },
}));

export function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery('(max-width: 429px)');
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
          Choose what you'd like to drill today
        </Typography>
      </Header>

      <CardsGrid>
        {FEATURE_NAV_ITEMS.map((feature) => {
          const color = theme.palette[feature.colorKey].main;
          const stats = progressStats[feature.statsKey];

          return (
            <FeatureCard
              key={feature.path}
              color={color}
              icon={<feature.icon sx={{ fontSize: 28 }} />}
              title={feature.label}
              description={isCompact ? feature.description : feature.fullDescription}
              badge={<ReviewCountBadge count={stats.due} loading={loading} />}
              onClick={() => navigate(feature.path)}
            >
              <ProgressStats
                learned={stats.learned}
                total={stats.total}
                color={color}
                layout="inline"
                loading={loading}
              />
            </FeatureCard>
          );
        })}
        {EXTRA_NAV_ITEMS.map((item) => {
          const color = theme.palette[item.colorKey].main;
          return (
            <FeatureCard
              key={item.path}
              color={color}
              icon={<item.icon sx={{ fontSize: 28 }} />}
              title={item.label}
              description={isCompact ? item.description : item.fullDescription}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </CardsGrid>
    </PageContainer>
  );
}

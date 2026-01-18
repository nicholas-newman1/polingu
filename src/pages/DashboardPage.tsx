import { useNavigate } from 'react-router-dom';
import { Box, Typography, ButtonBase, useTheme } from '@mui/material';
import { School, Abc, Translate } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { useReviewData } from '../hooks/useReviewData';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import type { ReviewCounts } from '../contexts/ReviewDataContext';
import { SITE_NAME } from '../constants';
import { SiteLogo } from '../components/SiteLogo';

type ColorKey = 'primary' | 'info' | 'success';

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

const FeatureCard = styled(ButtonBase)<{ $color: string }>(
  ({ theme, $color }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: theme.spacing(3),
    borderRadius: 16,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    textAlign: 'left',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      background: $color,
    },
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: `0 12px 32px ${alpha($color, 0.2)}`,
      borderColor: alpha($color, 0.3),
    },
    '&:active': {
      transform: 'translateY(-2px)',
    },
  })
);

const IconWrapper = styled(Box)<{ $color: string }>(({ theme, $color }) => ({
  width: 56,
  height: 56,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha($color, 0.1),
  color: $color,
  marginBottom: theme.spacing(2),
}));

const FeatureTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
  color: theme.palette.text.primary,
}));

const FeatureDescription = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

const FEATURES: Array<{
  path: string;
  icon: typeof School;
  title: string;
  description: string;
  colorKey: ColorKey;
  reviewCountKey?: keyof ReviewCounts;
}> = [
  {
    path: '/declension',
    icon: School,
    title: 'Declension',
    description:
      'Practice noun and pronoun declensions with spaced repetition flashcards',
    colorKey: 'primary',
    reviewCountKey: 'declension',
  },
  {
    path: '/vocabulary',
    icon: Abc,
    title: 'Vocabulary',
    description:
      'Learn the top 1000 most common Polish words with example sentences',
    colorKey: 'info',
    reviewCountKey: 'vocabulary',
  },
  {
    path: '/sentences',
    icon: Translate,
    title: 'Sentences',
    description:
      'Translate full sentences and explore word-by-word grammar annotations',
    colorKey: 'success',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { counts, loading } = useReviewData();

  return (
    <PageContainer>
      <Header>
        <Title
          variant="h3"
          color="text.primary"
          sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}
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
          const reviewCount = feature.reviewCountKey
            ? counts[feature.reviewCountKey]
            : undefined;
          return (
            <FeatureCard
              key={feature.path}
              $color={color}
              onClick={() => navigate(feature.path)}
            >
              {feature.reviewCountKey && (
                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                  <ReviewCountBadge count={reviewCount} loading={loading} />
                </Box>
              )}
              <IconWrapper $color={color}>
                <feature.icon sx={{ fontSize: 28 }} />
              </IconWrapper>
              <FeatureTitle variant="h6">{feature.title}</FeatureTitle>
              <FeatureDescription variant="body2">
                {feature.description}
              </FeatureDescription>
            </FeatureCard>
          );
        })}
      </CardsGrid>
    </PageContainer>
  );
}

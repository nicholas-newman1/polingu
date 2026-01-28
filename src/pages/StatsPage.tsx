import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import { School, Abc } from '@mui/icons-material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { useReviewData } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  maxWidth: 800,
  margin: '0 auto',
  width: '100%',
}));

const Header = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const Title = styled(Typography)({
  fontWeight: 300,
  letterSpacing: '-0.02em',
});

const SectionCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
}));

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 16,
});

const SectionTitle = styled(Typography)({
  fontWeight: 600,
});

const StatsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: theme.spacing(2),
}));

const StatBox = styled(Box)<{ $color?: string }>(({ theme, $color }) => ({
  backgroundColor: $color ? alpha($color, 0.08) : theme.palette.action.hover,
  borderRadius: 12,
  padding: theme.spacing(2),
  textAlign: 'center',
}));

const StatValue = styled(Typography)<{ $color?: string }>(({ $color }) => ({
  fontSize: '2rem',
  fontWeight: 600,
  color: $color || 'inherit',
  lineHeight: 1.2,
}));

const StatLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginTop: theme.spacing(0.5),
}));

const BreakdownText = styled(Typography)(({ theme }) => ({
  fontSize: '0.8rem',
  color: theme.palette.text.disabled,
  marginTop: theme.spacing(2),
  textAlign: 'right',
}));

interface CategoryStats {
  total: number;
  system: number;
  custom: number;
  studied: number;
  mastered: number;
}

function StatBoxWithLoading({
  value,
  label,
  color,
  loading,
}: {
  value: number;
  label: string;
  color?: string;
  loading: boolean;
}) {
  return (
    <StatBox $color={color}>
      {loading ? (
        <Skeleton variant="text" width={60} height={48} sx={{ mx: 'auto' }} />
      ) : (
        <StatValue $color={color}>{value}</StatValue>
      )}
      <StatLabel>{label}</StatLabel>
    </StatBox>
  );
}

export function StatsPage() {
  const theme = useTheme();
  const { loading, systemWords, customWords, systemDeclensionCards, customDeclensionCards } =
    useReviewData();
  const progressStats = useProgressStats();

  const vocabularyStats: CategoryStats = {
    total: progressStats.vocabulary.total,
    system: systemWords.length,
    custom: customWords.length,
    studied: progressStats.vocabulary.learned,
    mastered: progressStats.vocabulary.mastered,
  };

  const declensionStats: CategoryStats = {
    total: progressStats.declension.total,
    system: systemDeclensionCards.length,
    custom: customDeclensionCards.length,
    studied: progressStats.declension.learned,
    mastered: progressStats.declension.mastered,
  };

  const formatBreakdown = (system: number, custom: number) => {
    if (custom === 0) return `${system} system`;
    return `${system} system + ${custom} custom`;
  };

  return (
    <PageContainer>
      <Header>
        <Title variant="h4" color="text.primary">
          Study Statistics
        </Title>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Track your learning progress across vocabulary and declensions
        </Typography>
      </Header>

      <SectionCard>
        <SectionHeader>
          <Abc color="action" />
          <SectionTitle variant="h6">Vocabulary</SectionTitle>
        </SectionHeader>
        <StatsGrid>
          <StatBoxWithLoading
            value={vocabularyStats.studied}
            label="Studied"
            color={theme.palette.warning.main}
            loading={loading}
          />
          <StatBoxWithLoading
            value={vocabularyStats.mastered}
            label="Mastered"
            color={theme.palette.success.main}
            loading={loading}
          />
          <StatBoxWithLoading value={vocabularyStats.total} label="Total" loading={loading} />
        </StatsGrid>
        {!loading && (
          <BreakdownText>
            {formatBreakdown(vocabularyStats.system, vocabularyStats.custom)}
          </BreakdownText>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeader>
          <School color="action" />
          <SectionTitle variant="h6">Declension</SectionTitle>
        </SectionHeader>
        <StatsGrid>
          <StatBoxWithLoading
            value={declensionStats.studied}
            label="Studied"
            color={theme.palette.warning.main}
            loading={loading}
          />
          <StatBoxWithLoading
            value={declensionStats.mastered}
            label="Mastered"
            color={theme.palette.success.main}
            loading={loading}
          />
          <StatBoxWithLoading value={declensionStats.total} label="Total" loading={loading} />
        </StatsGrid>
        {!loading && (
          <BreakdownText>
            {formatBreakdown(declensionStats.system, declensionStats.custom)}
          </BreakdownText>
        )}
      </SectionCard>
    </PageContainer>
  );
}

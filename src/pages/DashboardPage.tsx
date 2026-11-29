import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Typography, useMediaQuery, useTheme } from '@mui/material';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { useReviewDataLoading } from '../hooks/useReviewData';
import { useProgressStats } from '../hooks/useProgressStats';
import { FeatureCard } from '../components/FeatureCard';
import { ProgressStats } from '../components/ProgressStats';
import { ReviewCountBadge } from '../components/ReviewCountBadge';
import { SITE_NAME } from '../constants';
import {
  ADMIN_NAV_ITEMS,
  getOrderedDashboardItems,
  type DashboardNavItem,
} from '../constants/navigation';
import { SiteLogo } from '../components/SiteLogo';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuthContext } from '../contexts/AuthContext';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: 0,
  [theme.breakpoints.up('sm')]: {
    justifyContent: 'center',
    padding: theme.spacing(2),
    minHeight: '60vh',
  },
}));

const Header = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(2.5),
  [theme.breakpoints.up('sm')]: {
    marginBottom: theme.spacing(6),
  },
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: 300,
  letterSpacing: '-0.02em',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.75rem',
  },
}));

const CardsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1),
  width: '100%',
  maxWidth: 960,
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(3),
  },
}));

const AdminSection = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 960,
  marginTop: theme.spacing(3),
  [theme.breakpoints.up('sm')]: {
    marginTop: theme.spacing(5),
  },
}));

const MobileRow = styled(ButtonBase)<{ $color: string }>(({ theme, $color }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  width: '100%',
  padding: theme.spacing(1.25, 1.25, 1.25, 1.75),
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'left',
  position: 'relative',
  overflow: 'hidden',
  transition: 'background-color 150ms ease, transform 120ms ease',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    background: $color,
  },
  '&:active': {
    backgroundColor: theme.palette.action.hover,
    transform: 'scale(0.99)',
  },
}));

const MobileIconBox = styled(Box)<{ $color: string }>(({ $color }) => ({
  width: 38,
  height: 38,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  backgroundColor: alpha($color, 0.1),
  color: $color,
}));

const MobileRowContent = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const MobileRowEnd = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
  color: theme.palette.text.disabled,
}));

export function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const loading = useReviewDataLoading();
  const progressStats = useProgressStats();
  const { settings } = useAppSettings();
  const { isAdmin } = useAuthContext();
  const orderedItems = getOrderedDashboardItems(settings.dashboardOrder);

  const renderItem = (item: DashboardNavItem) => {
    const color = theme.palette[item.colorKey].main;
    const stats = item.kind === 'feature' ? progressStats[item.statsKey] : undefined;

    if (isMobile) {
      return (
        <MobileRow key={item.path} $color={color} onClick={() => navigate(item.path)}>
          <MobileIconBox $color={color}>
            <item.icon sx={{ fontSize: 21 }} />
          </MobileIconBox>
          <MobileRowContent>
            <Typography
              variant="subtitle1"
              color="text.primary"
              noWrap
              sx={{ fontWeight: 600, fontSize: '0.975rem', lineHeight: 1.25 }}
            >
              {item.label}
            </Typography>
            {stats ? (
              <ProgressStats
                learned={stats.learned}
                total={stats.total}
                color={color}
                layout="compact"
                loading={loading}
              />
            ) : (
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
                sx={{ fontSize: '0.78rem', lineHeight: 1.35 }}
              >
                {item.description}
              </Typography>
            )}
          </MobileRowContent>
          <MobileRowEnd>
            {stats && <ReviewCountBadge count={stats.due} loading={loading} />}
            <ChevronRight sx={{ fontSize: 18, opacity: 0.55 }} />
          </MobileRowEnd>
        </MobileRow>
      );
    }

    return (
      <FeatureCard
        key={item.path}
        color={color}
        icon={<item.icon sx={{ fontSize: 28 }} />}
        title={item.label}
        description={item.fullDescription}
        badge={stats && <ReviewCountBadge count={stats.due} loading={loading} />}
        onClick={() => navigate(item.path)}
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
  };

  return (
    <PageContainer>
      <Header>
        <Title
          variant="h3"
          color="text.primary"
          sx={{
            mb: { xs: 0.25, sm: 1 },
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.5 },
            justifyContent: 'center',
          }}
        >
          <SiteLogo size={isMobile ? 28 : 40} /> {SITE_NAME}
        </Title>
        <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary">
          Choose what you'd like to drill today
        </Typography>
      </Header>

      <CardsGrid>{orderedItems.map(renderItem)}</CardsGrid>

      {isAdmin && (
        <AdminSection>
          <Typography
            variant="overline"
            color="text.secondary"
            component="h2"
            sx={{ mb: { xs: 1, sm: 2 } }}
          >
            Admin
          </Typography>
          <CardsGrid>
            {ADMIN_NAV_ITEMS.map((item) => renderItem({ ...item, kind: 'extra' }))}
          </CardsGrid>
        </AdminSection>
      )}
    </PageContainer>
  );
}

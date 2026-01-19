import { Box, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

type Layout = 'inline' | 'stacked';

interface ProgressStatsProps {
  learned: number;
  total: number;
  color: string;
  layout?: Layout;
}

const StatsContainer = styled(Box)<{ $layout: Layout }>(
  ({ theme, $layout }) => ({
    display: 'flex',
    flexDirection: $layout === 'stacked' ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: $layout === 'stacked' ? 'center' : 'flex-start',
    gap: $layout === 'stacked' ? theme.spacing(2) : theme.spacing(1.5),
    marginTop: theme.spacing(2),
    width: '100%',
  })
);

const StatsRow = styled(Box)<{ $layout: Layout }>(({ theme, $layout }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: $layout === 'stacked' ? 'center' : 'flex-start',
  gap: theme.spacing($layout === 'stacked' ? 2 : 1.5),
}));

const StatItem = styled(Box)<{ $layout: Layout }>(({ theme, $layout }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: $layout === 'stacked' ? 'center' : 'flex-start',
  gap: theme.spacing(0.25),
}));

const StatValue = styled(Typography)<{ $layout: Layout }>(({ $layout }) => ({
  fontWeight: 600,
  fontSize: $layout === 'stacked' ? '1.25rem' : '1.1rem',
  lineHeight: 1,
}));

const StatLabel = styled(Typography)<{ $layout: Layout }>(
  ({ theme, $layout }) => ({
    color: theme.palette.text.disabled,
    fontSize: $layout === 'stacked' ? '0.7rem' : '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  })
);

const ProgressBar = styled(Box)<{ $layout: Layout }>(({ theme, $layout }) => ({
  flex: $layout === 'inline' ? 1 : undefined,
  width: $layout === 'stacked' ? '100%' : undefined,
  height: 4,
  backgroundColor: alpha(theme.palette.text.disabled, 0.15),
  borderRadius: 2,
  overflow: 'hidden',
  alignSelf: 'center',
}));

const ProgressFill = styled(Box)<{ $progress: number; $color: string }>(
  ({ $progress, $color }) => ({
    height: '100%',
    width: `${Math.min($progress, 100)}%`,
    backgroundColor: $color,
    borderRadius: 2,
    transition: 'width 0.3s ease',
  })
);

export function ProgressStats({
  learned,
  total,
  color,
  layout = 'inline',
}: ProgressStatsProps) {
  const progress = total > 0 ? (learned / total) * 100 : 0;

  return (
    <StatsContainer $layout={layout}>
      <StatsRow $layout={layout}>
        <StatItem $layout={layout}>
          <StatValue $layout={layout} color="text.primary">
            {learned}
          </StatValue>
          <StatLabel $layout={layout}>Learned</StatLabel>
        </StatItem>
        <Typography color="text.disabled" sx={{ fontSize: '0.75rem' }}>
          /
        </Typography>
        <StatItem $layout={layout}>
          <StatValue $layout={layout} color="text.secondary">
            {total}
          </StatValue>
          <StatLabel $layout={layout}>Total</StatLabel>
        </StatItem>
      </StatsRow>
      <ProgressBar $layout={layout}>
        <ProgressFill $progress={progress} $color={color} />
      </ProgressBar>
    </StatsContainer>
  );
}


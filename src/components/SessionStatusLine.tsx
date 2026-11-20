import { Box, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { ReviewCountBadge } from './ReviewCountBadge';

const StatusContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  marginBottom: theme.spacing(3),
  [theme.breakpoints.up('sm')]: {
    marginBottom: theme.spacing(4),
  },
}));

const ProgressTrack = styled(Box)(({ theme }) => ({
  width: '100%',
  height: 4,
  borderRadius: 999,
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  overflow: 'hidden',
}));

const ProgressFill = styled(Box)<{ $accent: 'success' | 'consonants' }>(({ theme, $accent }) => ({
  height: '100%',
  borderRadius: 999,
  background:
    $accent === 'consonants'
      ? `linear-gradient(90deg, ${theme.palette.consonants.main}, ${theme.palette.info.main})`
      : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main} 55%, ${theme.palette.success.main})`,
  transition: 'width 360ms cubic-bezier(0.22, 1, 0.36, 1)',
}));

interface SessionProgressBarProps {
  completed: number;
  total: number;
  accent?: 'success' | 'consonants';
}

export function SessionProgressBar({
  completed,
  total,
  accent = 'success',
}: SessionProgressBarProps) {
  if (total <= 0) return null;
  const percent = Math.max(0, Math.min(100, (completed / total) * 100));

  return (
    <ProgressTrack
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Session progress"
    >
      <ProgressFill $accent={accent} sx={{ width: `${percent}%` }} />
    </ProgressTrack>
  );
}

interface SessionStatusLineProps {
  session: {
    isFinished: boolean;
    isPracticeAhead: boolean;
    reviewCount: number;
    newCount: number;
    totalRemaining: number;
    sessionTotal: number;
    practice: { active: boolean; cards: unknown[] };
  };
  /** Plural noun for the practice deck count, e.g. "words". */
  unitLabel: string;
}

export function SessionStatusLine({ session, unitLabel }: SessionStatusLineProps) {
  const {
    isFinished,
    isPracticeAhead,
    reviewCount,
    newCount,
    totalRemaining,
    sessionTotal,
    practice,
  } = session;

  if (!practice.active && isFinished) {
    return null;
  }

  const completed = Math.max(0, sessionTotal - totalRemaining);

  return (
    <StatusContainer>
      <Typography
        variant="body2"
        color="text.disabled"
        sx={{
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        {practice.active ? (
          `Drill Mode · ${practice.cards.length} ${unitLabel}`
        ) : isPracticeAhead ? (
          <>
            Drill Ahead · <ReviewCountBadge count={totalRemaining} /> remaining
          </>
        ) : (
          <>
            {reviewCount} reviews · {newCount} new · <ReviewCountBadge count={totalRemaining} />{' '}
            remaining
          </>
        )}
      </Typography>

      {!practice.active && sessionTotal > 0 && (
        <SessionProgressBar completed={completed} total={sessionTotal} />
      )}
    </StatusContainer>
  );
}

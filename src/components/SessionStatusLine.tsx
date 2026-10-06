import { Typography } from '@mui/material';
import { ReviewCountBadge } from './ReviewCountBadge';

interface SessionStatusLineProps {
  session: {
    isFinished: boolean;
    isPracticeAhead: boolean;
    reviewCount: number;
    newCount: number;
    totalRemaining: number;
    practice: { active: boolean; cards: unknown[] };
  };
  /** Plural noun for the practice deck count, e.g. "words". */
  unitLabel: string;
}

export function SessionStatusLine({ session, unitLabel }: SessionStatusLineProps) {
  const { isFinished, isPracticeAhead, reviewCount, newCount, totalRemaining, practice } = session;

  return (
    <Typography
      variant="body2"
      color="text.disabled"
      sx={{
        mb: { xs: 3, sm: 4 },
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      {practice.active ? (
        `Drill Mode · ${practice.cards.length} ${unitLabel}`
      ) : isFinished ? null : isPracticeAhead ? (
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
  );
}

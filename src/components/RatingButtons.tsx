import { Rating, type Grade } from 'ts-fsrs';
import { Button, Stack, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { getRatingPalette, type RatingOutcome } from '../lib/ratingColors';

export interface RatingIntervals {
  [Rating.Again]: string;
  [Rating.Hard]: string;
  [Rating.Good]: string;
  [Rating.Easy]: string;
}

interface RatingButtonsProps {
  intervals?: RatingIntervals;
  onRate: (rating: Grade) => void;
}

interface RatingButtonProps {
  $outcome: RatingOutcome;
}

const RatingButton = styled(Button)<RatingButtonProps>(({ theme, $outcome }) => ({
  flexDirection: 'column',
  padding: theme.spacing(1.5, 1),
  borderRadius: theme.spacing(1),
  backgroundColor: getRatingPalette(theme, $outcome).main,
  touchAction: 'manipulation',
  '&:hover': {
    backgroundColor: getRatingPalette(theme, $outcome).dark,
  },
  '&:active': {
    backgroundColor: getRatingPalette(theme, $outcome).dark,
    transform: 'scale(0.96)',
    transition: 'none',
  },
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2, 1),
  },
}));

const IntervalText = styled(Typography)({
  opacity: 0.8,
  fontFamily: '"JetBrains Mono", monospace',
});

const RATINGS: Array<{
  rating: Grade;
  label: string;
  outcome: RatingOutcome;
}> = [
  { rating: Rating.Again, label: 'Again', outcome: 'again' },
  { rating: Rating.Hard, label: 'Hard', outcome: 'hard' },
  { rating: Rating.Good, label: 'Good', outcome: 'good' },
  { rating: Rating.Easy, label: 'Easy', outcome: 'easy' },
];

export function RatingButtons({ intervals, onRate }: RatingButtonsProps) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 'auto' }}>
      {RATINGS.map(({ rating, label, outcome }) => (
        <RatingButton
          key={rating}
          fullWidth
          variant="contained"
          $outcome={outcome}
          onClick={() => onRate(rating)}
        >
          <Typography variant="body2" fontWeight={600}>
            {label}
          </Typography>
          <IntervalText variant="caption">{intervals?.[rating]}</IntervalText>
        </RatingButton>
      ))}
    </Stack>
  );
}

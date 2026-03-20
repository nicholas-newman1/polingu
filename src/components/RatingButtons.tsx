import { Rating, type Grade } from 'ts-fsrs';
import { Button, Stack, Typography } from '@mui/material';
import { styled } from '../lib/styled';

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
  $ratingColor: 'primary' | 'warning' | 'success' | 'info';
}

const RatingButton = styled(Button)<RatingButtonProps>(({ theme, $ratingColor }) => ({
  flexDirection: 'column',
  padding: theme.spacing(1.5, 1),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette[$ratingColor].main,
  '&:hover': {
    backgroundColor: theme.palette[$ratingColor].dark,
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
  color: 'primary' | 'warning' | 'success' | 'info';
}> = [
  { rating: Rating.Again, label: 'Again', color: 'primary' },
  { rating: Rating.Hard, label: 'Hard', color: 'warning' },
  { rating: Rating.Good, label: 'Good', color: 'success' },
  { rating: Rating.Easy, label: 'Easy', color: 'info' },
];

export function RatingButtons({ intervals, onRate }: RatingButtonsProps) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 'auto' }}>
      {RATINGS.map(({ rating, label, color }) => (
        <RatingButton
          key={rating}
          fullWidth
          variant="contained"
          $ratingColor={color}
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

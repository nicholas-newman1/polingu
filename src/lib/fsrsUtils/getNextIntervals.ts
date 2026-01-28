import { Rating, type Card as FSRSCard, type Grade } from 'ts-fsrs';
import f from './fsrsInstance';
import formatInterval from './formatInterval';

export default function getNextIntervals(
  fsrsCard: FSRSCard,
  now: Date = new Date()
): Record<Grade, string> {
  const result = f.repeat(fsrsCard, now);

  return {
    [Rating.Again]: formatInterval(result[Rating.Again].card, now),
    [Rating.Hard]: formatInterval(result[Rating.Hard].card, now),
    [Rating.Good]: formatInterval(result[Rating.Good].card, now),
    [Rating.Easy]: formatInterval(result[Rating.Easy].card, now),
  };
}

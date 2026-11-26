import { useEffect, useState } from 'react';
import { getTodayString } from '../../lib/storage/helpers';

const SLACK_MS = 1000;

function msUntilTomorrow(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime() - now.getTime() + SLACK_MS;
}

/**
 * Today's date (getTodayString), re-rendering the caller when the day changes,
 * so the day's lists start afresh while the app stays open past midnight.
 */
export function useToday(): string {
  const [, setDay] = useState(getTodayString);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Setting the same day again does not re-render.
    const check = () => {
      setDay(getTodayString());
      clearTimeout(timer);
      timer = setTimeout(check, msUntilTomorrow());
    };
    timer = setTimeout(check, msUntilTomorrow());
    // Timers can run late after the device sleeps, so look again on return too.
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  // Read at render, so any re-render after midnight is already on the new day.
  return getTodayString();
}

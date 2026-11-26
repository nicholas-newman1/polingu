import { beforeEach, vi } from 'vitest';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

let dayStart = Date.UTC(2026, 0, 1);

/**
 * Freezes Date for each test at noon UTC on a fresh day, two days after the
 * previous test's. Time only moves forward across a file, so module-level caches
 * that expire by time (the 30 second kill switch cache) never leak between tests.
 */
export function installTestClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    dayStart += 2 * DAY;
    vi.setSystemTime(dayStart + 12 * HOUR);
  });
}

/** Moves the frozen clock to hh:mm:ss UTC on the current test's day (hours may exceed 23). */
export function setUtcTime(hours: number, minutes = 0, seconds = 0) {
  vi.setSystemTime(dayStart + hours * HOUR + minutes * MINUTE + seconds * SECOND);
}

/** The UTC calendar date (YYYY-MM-DD) of a timestamp, today by default. */
export function utcDate(at = Date.now()) {
  return new Date(at).toISOString().slice(0, 10);
}

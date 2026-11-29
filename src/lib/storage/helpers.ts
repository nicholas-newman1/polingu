/**
 * Local calendar date as YYYY-MM-DD. Daily review counters roll over at the
 * user's midnight, not UTC midnight.
 */
export function getTodayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

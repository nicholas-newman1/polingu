import type { Card as FSRSCard } from 'ts-fsrs';

export default function formatInterval(card: FSRSCard, now: Date = new Date()): string {
  const due = new Date(card.due);
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return '<1m';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

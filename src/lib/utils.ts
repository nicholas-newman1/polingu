import type { ReviewDataStore } from '../types';

export function getFirstName(
  displayName: string | null,
  email: string | null
): string {
  if (displayName) {
    return displayName.split(' ')[0];
  }
  if (email) {
    return email.split('@')[0];
  }
  return '';
}

export function getDefaultReviewStore(): ReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: new Date().toISOString().split('T')[0],
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface ReviewStageSession<S, C> {
  practice: { active: boolean; current: C | undefined };
  history: { isViewingHistory: boolean; historyCard: C | null };
  isFinished: boolean;
  currentCard: S | null | undefined;
}

interface ReviewStageProps<S, C> {
  session: ReviewStageSession<S, C>;
  practiceEmptyMessage: string;
  renderPractice: (card: C) => ReactNode;
  renderHistory: (card: C) => ReactNode;
  renderFinished: () => ReactNode;
  renderCurrent: (sessionCard: S) => ReactNode;
  /** Shown when the session has no current card and isn't finished. */
  fallback?: ReactNode;
}

/** Picks what a review page shows: the practice deck, a card from history, the finished state, or the current card. */
export function ReviewStage<S, C>({
  session: { practice, history, isFinished, currentCard },
  practiceEmptyMessage,
  renderPractice,
  renderHistory,
  renderFinished,
  renderCurrent,
  fallback = null,
}: ReviewStageProps<S, C>) {
  if (practice.active) {
    return practice.current ? (
      renderPractice(practice.current)
    ) : (
      <EmptyState message={practiceEmptyMessage} />
    );
  }
  if (history.isViewingHistory && history.historyCard) return renderHistory(history.historyCard);
  if (isFinished) return renderFinished();
  if (currentCard) return renderCurrent(currentCard);
  return fallback;
}

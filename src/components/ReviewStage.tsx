import type { ReactNode } from 'react';
import { CardDeckStage } from './CardDeckStage';
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
  let content: ReactNode = fallback;
  if (practice.active) {
    content = practice.current ? (
      renderPractice(practice.current)
    ) : (
      <EmptyState message={practiceEmptyMessage} />
    );
  } else if (history.isViewingHistory && history.historyCard) {
    content = renderHistory(history.historyCard);
  } else if (isFinished) {
    content = renderFinished();
  } else if (currentCard) {
    content = renderCurrent(currentCard);
  }

  return <CardDeckStage>{content}</CardDeckStage>;
}

import { Fragment, type ComponentProps, type ReactNode } from 'react';
import type { Grade } from 'ts-fsrs';
import type { TranslationDirection } from '../types/common';
import type { RatingIntervals } from './RatingButtons';
import type { ReviewControls } from './FlashcardShell';
import { CardDeckStage } from './CardDeckStage';
import { EmptyState } from './EmptyState';
import { FinishedState, type FeatureType } from './FinishedState';
import { SessionStatusLine } from './SessionStatusLine';

interface ReviewStageSession<C> {
  idOf: (card: C) => string | number;
  currentItem: C | undefined;
  isBuilt: boolean;
  isFinished: boolean;
  ratingCounter: number;
  totalRemaining: number;
  intervals: RatingIntervals;
  reassessIntervals: RatingIntervals | undefined;
  rate: (rating: Grade) => void;
  reassess: (rating: Grade) => void;
  practice: { active: boolean; current: C | undefined; index: number; next: () => void };
  history: {
    isViewingHistory: boolean;
    historyCard: C | null;
    canGoBack: boolean;
    goBack: () => void;
    goForward: () => void;
  };
  finishedStateProps: Omit<ComponentProps<typeof FinishedState>, 'currentFeature' | 'direction'>;
}

interface ReviewStageProps<C> {
  session: ReviewStageSession<C> & ComponentProps<typeof SessionStatusLine>['session'];
  feature: FeatureType;
  direction?: TranslationDirection;
  /** Plural noun for the practice deck count, e.g. "words". */
  unitLabel: string;
  practiceEmptyMessage: string;
  /** Renders a card with the controls for where it is shown: practice, history or the session. */
  renderCard: (card: C, controls: ReviewControls) => ReactNode;
  /** Shown when the session has no current card and isn't finished. */
  fallback?: ReactNode;
}

/**
 * A review page's session: its status line, then the practice deck, a card from
 * history, the finished state, or the current card.
 */
export function ReviewStage<C>({
  session,
  feature,
  direction,
  unitLabel,
  practiceEmptyMessage,
  renderCard,
  fallback = null,
}: ReviewStageProps<C>) {
  const { practice, history, idOf } = session;

  // Each card gets its own key, so a new card (or the same card again) starts unrevealed.
  const card = (item: C, key: string, controls: ReviewControls) => (
    <Fragment key={key}>{renderCard(item, controls)}</Fragment>
  );

  let content: ReactNode = fallback;
  if (practice.active) {
    content = practice.current ? (
      card(practice.current, `practice-${idOf(practice.current)}-${practice.index}`, {
        practiceMode: true,
        onNext: practice.next,
      })
    ) : (
      <EmptyState message={practiceEmptyMessage} />
    );
  } else if (history.isViewingHistory && history.historyCard) {
    content = card(history.historyCard, `history-${idOf(history.historyCard)}`, {
      isViewingHistory: true,
      canGoBack: history.canGoBack,
      reassessIntervals: session.reassessIntervals,
      onGoBack: history.goBack,
      onContinue: history.goForward,
      onReassess: session.reassess,
    });
  } else if (session.isFinished) {
    content = (
      <FinishedState
        currentFeature={feature}
        direction={direction}
        {...session.finishedStateProps}
      />
    );
  } else if (session.currentItem) {
    const current = session.currentItem;
    content = card(current, `${idOf(current)}-${session.ratingCounter}`, {
      intervals: session.intervals,
      remainingCount: session.totalRemaining,
      canGoBack: history.canGoBack,
      onRate: session.rate,
      onGoBack: history.goBack,
    });
  }

  return (
    <>
      {session.isBuilt && <SessionStatusLine session={session} unitLabel={unitLabel} />}
      <CardDeckStage>{content}</CardDeckStage>
    </>
  );
}

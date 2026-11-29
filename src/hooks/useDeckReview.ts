import { useState } from 'react';
import type { DeckProgress } from '../contexts/review';
import type { DeckPart } from '../lib/storage/reviewDeckDocs';
import type { ConfirmOptions } from '../components/ConfirmDialog';
import type { ReviewDataStore, SessionId, TranslationDirection } from '../types/common';
import {
  useReviewSession,
  type ReviewableSessionCard,
  type UseReviewSessionOptions,
} from './useReviewSession';

const DIRECTION_SHORT_LABELS: Record<TranslationDirection, string> = {
  'pl-to-en': 'PL→EN',
  'en-to-pl': 'EN→PL',
};

/** Names the direction being reset; a deck without directions keeps the panel's own label. */
const resetButtonLabel = (part: DeckPart) =>
  part === 'all' ? undefined : `Reset ${DIRECTION_SHORT_LABELS[part]} Progress`;

type DeckReviewOptions<
  S extends ReviewableSessionCard,
  K extends keyof S,
  Id extends SessionId,
  Filters,
> = Omit<
  UseReviewSessionOptions<S, K, Id, Filters>,
  'store' | 'settings' | 'save' | 'sessionKey'
> & {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** The reset confirmation's warning. */
  resetMessage: string;
};

/**
 * The review session for one part of a deck (a direction, or `all`), saved through the
 * deck's progress, with the settings panel that changes that part.
 */
export function useDeckReview<
  Part extends DeckPart,
  Settings extends { newCardsPerDay: number },
  S extends ReviewableSessionCard,
  K extends keyof S,
  Id extends SessionId,
  Filters,
>(
  progress: DeckProgress<Part, ReviewDataStore<S['reviewData'], Id>, Settings>,
  part: Part,
  { confirm, resetMessage, ...options }: DeckReviewOptions<S, K, Id, Filters>
) {
  const store = progress.stores[part];
  const settings = progress.settings[part];
  const session = useReviewSession({
    ...options,
    store,
    settings,
    sessionKey: part,
    save: (next) => progress.updateStore(part, next),
  });
  const [showSettings, setShowSettings] = useState(false);

  const settingsPanel = {
    newCardsPerDay: settings.newCardsPerDay,
    resetButtonLabel: resetButtonLabel(part),
    onSettingsChange: async (newCardsPerDay: number) => {
      await progress.updateSettings(part, { ...settings, newCardsPerDay });
      session.restartAfterRender();
    },
    onResetAllData: async () => {
      const confirmed = await confirm({
        title: 'Reset Progress',
        message: resetMessage,
        confirmLabel: 'Reset',
      });
      if (!confirmed) return;
      await progress.clear(part);
      session.restartAfterRender();
      setShowSettings(false);
    },
  };

  return {
    session,
    store,
    settings,
    showSettings,
    toggleSettings: () => setShowSettings((shown) => !shown),
    /** The deck part's props for SettingsPanel. */
    settingsPanel,
  };
}

import { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { AspectPairsFlashcard } from './components/AspectPairsFlashcard';
import { FinishedState } from '../../components/FinishedState';
import { ReviewStage } from '../../components/ReviewStage';
import { EmptyState } from '../../components/EmptyState';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SessionStatusLine } from '../../components/SessionStatusLine';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { EditAspectPairsModal } from '../../components/EditAspectPairsModal';
import type { AspectPairCard } from '../../types/aspectPairs';
import type { Verb, Aspect, VerbClass } from '../../types/conjugation';
import getAspectPairsSessionCards from '../../lib/aspectPairsScheduler/getAspectPairsSessionCards';
import getAspectPairsPracticeAheadCards from '../../lib/aspectPairsScheduler/getAspectPairsPracticeAheadCards';
import getAspectPairsExtraNewCards from '../../lib/aspectPairsScheduler/getAspectPairsExtraNewCards';
import { recordCardReview } from '../../lib/reviewSession/recordReview';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useAspectPairs, useConjugation } from '../../hooks/useReviewData';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useReviewSession } from '../../hooks/useReviewSession';
import { updateVerb } from '../../lib/storage/systemVerbs';

const replaceVerbs =
  (...updated: Verb[]) =>
  (verb: Verb): Verb =>
    updated.find((u) => u.id === verb.id) ?? verb;

export function AspectPairsPage() {
  const { user, isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const {
    aspectPairCards,
    aspectPairsReviewStore: reviewStore,
    aspectPairsSettings: settings,
    updateAspectPairsReviewStore,
    updateAspectPairsSettings,
    clearAspectPairsData,
  } = useAspectPairs();
  const { verbs: contextVerbs, setVerbs: setContextVerbs } = useConjugation();

  const [verbs, applyOptimisticVerbs] = useOptimistic(contextVerbs, {
    onError: () => showSnackbar('Failed to save. Please try again.', 'error'),
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<AspectPairCard | null>(null);

  const isLoading = !(aspectPairCards.length > 0 || reviewStore);

  const session = useReviewSession({
    cardKey: 'card',
    getId: (card) => card.verb.id,
    getAudioUrls: (card) => [card.verb.infinitiveAudioUrl, card.pairVerb.infinitiveAudioUrl],
    ready: !isLoading,
    getSessionCards: () => getAspectPairsSessionCards(aspectPairCards, reviewStore, settings),
    getPracticeAheadCards: (count) =>
      getAspectPairsPracticeAheadCards(aspectPairCards, reviewStore, count),
    getExtraNewCards: (count) => getAspectPairsExtraNewCards(aspectPairCards, reviewStore, count),
    reviewStore,
    recordReview: recordCardReview,
    saveReviewStore: updateAspectPairsReviewStore,
  });
  const { practice, history } = session;
  const { canGoBack, goBack, goForward } = history;

  const handleSettingsChange = async (newCardsPerDay: number) => {
    const newSettings = { ...settings, newCardsPerDay };
    await updateAspectPairsSettings(newSettings);
    session.startSession(getAspectPairsSessionCards(aspectPairCards, reviewStore, newSettings));
  };

  const handleResetAllData = async () => {
    if (
      window.confirm(
        'Are you sure? This will erase all your aspect pairs progress and cannot be undone.'
      )
    ) {
      await clearAspectPairsData();
      session.rebuildSession();
      setShowSettings(false);
    }
  };

  const openEditModal = (card: AspectPairCard) => {
    setEditingCard(card);
    setShowEditModal(true);
  };

  const updateVerbsInCards = (updatedVerb1: Verb, updatedVerb2: Verb) => {
    const ids = [updatedVerb1.id, updatedVerb2.id];
    const replace = replaceVerbs(updatedVerb1, updatedVerb2);
    session.updateCards(
      (card) => ids.includes(card.verb.id) || ids.includes(card.pairVerb.id),
      (card) => ({ ...card, verb: replace(card.verb), pairVerb: replace(card.pairVerb) })
    );
  };

  const handleSaveCard = (
    verb1Updates: {
      infinitive: string;
      infinitiveEn: string;
      aspect: Aspect;
      verbClass: VerbClass;
    },
    verb2Updates: {
      infinitive: string;
      infinitiveEn: string;
      aspect: Aspect;
      verbClass: VerbClass;
    }
  ) => {
    if (!editingCard) return;

    const verb1 = editingCard.verb;
    const verb2 = editingCard.pairVerb;
    const isBiaspectual = verb1.id === verb2.id;

    const updatedVerb1: Verb = { ...verb1, ...verb1Updates };
    const updatedVerb2: Verb = isBiaspectual ? updatedVerb1 : { ...verb2, ...verb2Updates };

    const newVerbs = verbs.map(replaceVerbs(updatedVerb1, updatedVerb2));

    updateVerbsInCards(updatedVerb1, updatedVerb2);

    applyOptimisticVerbs(newVerbs, async () => {
      await updateVerb(verb1.id, verb1Updates);
      if (!isBiaspectual) {
        await updateVerb(verb2.id, verb2Updates);
      }
      setContextVerbs(newVerbs);
    });
  };

  const unlinkPair = (
    card: AspectPairCard,
    { skipConfirm = false }: { skipConfirm?: boolean } = {}
  ): boolean => {
    const verb1 = card.verb;
    const verb2 = card.pairVerb;

    if (verb1.id === verb2.id) return false; // Can't unlink biaspectual

    if (
      !skipConfirm &&
      !window.confirm(
        'Are you sure you want to unlink this aspect pair? This will affect all users.'
      )
    ) {
      return false;
    }

    const updatedVerb1: Verb = { ...verb1, aspectPair: undefined };
    const updatedVerb2: Verb = { ...verb2, aspectPair: undefined };

    const newVerbs = verbs.map(replaceVerbs(updatedVerb1, updatedVerb2));

    session.removeCards(
      (c) =>
        (c.verb.id === verb1.id && c.pairVerb.id === verb2.id) ||
        (c.verb.id === verb2.id && c.pairVerb.id === verb1.id)
    );

    applyOptimisticVerbs(newVerbs, async () => {
      await updateVerb(verb1.id, { aspectPair: undefined });
      await updateVerb(verb2.id, { aspectPair: undefined });
      setContextVerbs(newVerbs);
    });
    return true;
  };

  const handleUnlinkPair = () => {
    if (!editingCard) return;
    unlinkPair(editingCard, { skipConfirm: true });
    setShowEditModal(false);
    setEditingCard(null);
  };

  const handleAudioUpdated = (which: 'verb' | 'pairVerb', audioUrl: string) => {
    if (!editingCard) return;
    const { verb, pairVerb } = editingCard;
    const isBiaspectual = verb.id === pairVerb.id;
    const updated: Verb = { ...editingCard[which], infinitiveAudioUrl: audioUrl };
    if (which === 'verb') {
      updateVerbsInCards(updated, isBiaspectual ? updated : pairVerb);
    } else {
      updateVerbsInCards(isBiaspectual ? updated : verb, updated);
    }
  };

  if (aspectPairCards.length === 0 && !isLoading) {
    return (
      <ReviewMainContent>
        <EmptyState message="No aspect pairs available. Verbs need aspectPair data to drill." />
      </ReviewMainContent>
    );
  }

  return (
    <>
      <ReviewControlsRow direction="row" alignItems="center">
        <PracticeModeButton
          active={practice.active}
          onClick={() => practice.toggle(aspectPairCards)}
          disabled={isLoading}
        />

        <SettingsButton
          active={showSettings}
          onClick={() => setShowSettings(!showSettings)}
          disabled={isLoading}
        />
      </ReviewControlsRow>

      {showSettings && !practice.active && (
        <SettingsPanel
          newCardsPerDay={settings.newCardsPerDay}
          user={user}
          onSettingsChange={handleSettingsChange}
          onResetAllData={handleResetAllData}
          resetButtonLabel="Reset Aspect Pairs Progress"
        />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <>
            <SessionStatusLine session={session} unitLabel="pairs" />

            <ReviewStage
              session={session}
              practiceEmptyMessage="No aspect pairs available"
              renderPractice={(card) => (
                <AspectPairsFlashcard
                  key={`practice-${card.verb.id}-${practice.index}`}
                  card={card}
                  practiceMode
                  canEdit={isAdmin}
                  onNext={practice.next}
                  onEdit={() => openEditModal(card)}
                  onUnlink={() => unlinkPair(card)}
                />
              )}
              renderHistory={(card) => (
                <AspectPairsFlashcard
                  key={`history-${card.verb.id}`}
                  card={card}
                  isViewingHistory
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  reassessIntervals={session.reassessIntervals}
                  onGoBack={goBack}
                  onContinue={goForward}
                  onReassess={session.reassess}
                  onEdit={() => openEditModal(card)}
                  onUnlink={() => {
                    if (unlinkPair(card)) goForward();
                  }}
                />
              )}
              renderFinished={() => (
                <FinishedState currentFeature="aspectPairs" {...session.finishedStateProps} />
              )}
              renderCurrent={({ card }) => (
                <AspectPairsFlashcard
                  key={`${card.verb.id}-${session.ratingCounter}`}
                  card={card}
                  intervals={session.intervals}
                  canGoBack={canGoBack}
                  canEdit={isAdmin}
                  onRate={session.rate}
                  onGoBack={goBack}
                  onEdit={() => openEditModal(card)}
                  onUnlink={() => unlinkPair(card)}
                />
              )}
            />
          </>
        )}
      </ReviewMainContent>

      <EditAspectPairsModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        onUnlink={isAdmin ? handleUnlinkPair : undefined}
        card={editingCard}
        onVerb1AudioUpdated={(audioUrl) => handleAudioUpdated('verb', audioUrl)}
        onVerb2AudioUpdated={(audioUrl) => handleAudioUpdated('pairVerb', audioUrl)}
      />
    </>
  );
}

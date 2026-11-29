import { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { PracticeModeButton } from '../../components/PracticeModeButton';
import { SettingsButton } from '../../components/SettingsButton';
import { AspectPairsFlashcard } from './components/AspectPairsFlashcard';
import { ReviewStage } from '../../components/ReviewStage';
import { EmptyState } from '../../components/EmptyState';
import { SettingsPanel } from '../../components/SettingsPanel';
import { ReviewControlsRow, ReviewMainContent } from '../../components/ReviewLayout';
import { EditAspectPairsModal } from '../../components/EditAspectPairsModal';
import type { AspectPairCard } from '../../types/aspectPairs';
import type { Verb, Aspect, VerbClass } from '../../types/conjugation';
import { aspectPairsDeck } from '../../lib/reviewSession/reviewDecks';
import { useAuthContext } from '../../contexts/AuthContext';
import { useAspectPairs, useConjugation, useReviewDataLoading } from '../../hooks/useReviewData';
import { useSaveError } from '../../hooks/useSaveError';
import { useConfirm } from '../../hooks/useConfirm';
import { useDeckReview } from '../../hooks/useDeckReview';
import { updateVerb } from '../../lib/storage/systemVerbs';
import { writeBuiltIn } from '../../lib/storage/writeBuiltIn';

interface VerbUpdates {
  infinitive: string;
  infinitiveEn: string;
  aspect: Aspect;
  verbClass: VerbClass;
}

const replaceVerbs =
  (...updated: Verb[]) =>
  (verb: Verb): Verb =>
    updated.find((u) => u.id === verb.id) ?? verb;

export function AspectPairsPage() {
  const { user, isAdmin } = useAuthContext();
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const loading = useReviewDataLoading();
  const { progress, cards } = useAspectPairs();
  const { verbs, setVerbs } = useConjugation();

  const [editingCard, setEditingCard] = useState<AspectPairCard | null>(null);

  const review = useDeckReview(progress, 'all', {
    deck: aspectPairsDeck,
    items: cards,
    ready: !loading && cards.length > 0,
    getAudioUrls: (card) => [card.verb.infinitiveAudioUrl, card.pairVerb.infinitiveAudioUrl],
    confirm,
    resetMessage:
      'Are you sure? This will erase all your aspect pairs progress and cannot be undone.',
  });
  const { session } = review;
  const { practice } = session;

  const updateVerbsInCards = (updatedVerb1: Verb, updatedVerb2: Verb) => {
    const ids = [updatedVerb1.id, updatedVerb2.id];
    const replace = replaceVerbs(updatedVerb1, updatedVerb2);
    session.updateCards(
      (card) => ids.includes(card.verb.id) || ids.includes(card.pairVerb.id),
      (card) => ({ ...card, verb: replace(card.verb), pairVerb: replace(card.pairVerb) })
    );
  };

  const handleSaveCard = (verb1Updates: VerbUpdates, verb2Updates: VerbUpdates) => {
    if (!editingCard) return;

    const verb1 = editingCard.verb;
    const verb2 = editingCard.pairVerb;
    const isBiaspectual = verb1.id === verb2.id;

    const updatedVerb1: Verb = { ...verb1, ...verb1Updates };
    const updatedVerb2: Verb = isBiaspectual ? updatedVerb1 : { ...verb2, ...verb2Updates };

    updateVerbsInCards(updatedVerb1, updatedVerb2);
    return writeBuiltIn(
      verbs,
      setVerbs,
      verbs.map(replaceVerbs(updatedVerb1, updatedVerb2)),
      async () => {
        await updateVerb(verb1.id, verb1Updates);
        if (!isBiaspectual) {
          await updateVerb(verb2.id, verb2Updates);
        }
      }
    );
  };

  const removePair = (card: AspectPairCard) => {
    const verb1 = card.verb;
    const verb2 = card.pairVerb;

    session.removeCards(
      (c) =>
        (c.verb.id === verb1.id && c.pairVerb.id === verb2.id) ||
        (c.verb.id === verb2.id && c.pairVerb.id === verb1.id)
    );
    const unlinked = verbs.map(
      replaceVerbs({ ...verb1, aspectPair: undefined }, { ...verb2, aspectPair: undefined })
    );
    void writeBuiltIn(verbs, setVerbs, unlinked, async () => {
      await updateVerb(verb1.id, { aspectPair: undefined });
      await updateVerb(verb2.id, { aspectPair: undefined });
    }).catch(showSaveError);
  };

  const unlinkPair = async (card: AspectPairCard): Promise<boolean> => {
    // A biaspectual verb is its own pair, with no partner to unlink.
    if (card.verb.id === card.pairVerb.id) return false;
    const confirmed = await confirm({
      title: 'Unlink Pair',
      message: 'Are you sure you want to unlink this aspect pair? This will affect all users.',
      confirmLabel: 'Unlink',
    });
    if (!confirmed) return false;
    removePair(card);
    return true;
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

  const isLoading = loading || !session.isBuilt;

  if (!loading && cards.length === 0) {
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
          onClick={session.togglePractice}
          disabled={isLoading}
        />

        <SettingsButton
          active={review.showSettings}
          onClick={review.toggleSettings}
          disabled={isLoading}
        />
      </ReviewControlsRow>

      {review.showSettings && !practice.active && (
        <SettingsPanel
          {...review.settingsPanel}
          user={user}
          resetButtonLabel="Reset Aspect Pairs Progress"
        />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <ReviewStage
            session={session}
            feature="aspectPairs"
            unitLabel="pairs"
            practiceEmptyMessage="No aspect pairs available"
            renderCard={(card, controls) => (
              <AspectPairsFlashcard
                {...controls}
                card={card}
                canEdit={isAdmin}
                onEdit={() => setEditingCard(card)}
                onUnlink={async () => {
                  if (await unlinkPair(card)) controls.onContinue?.();
                }}
              />
            )}
          />
        )}
      </ReviewMainContent>

      <EditAspectPairsModal
        open={editingCard !== null}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveCard}
        onUnlink={
          isAdmin
            ? () => {
                if (!editingCard) return;
                // The modal offers unlinking only for a pair of two verbs.
                removePair(editingCard);
                setEditingCard(null);
              }
            : undefined
        }
        card={editingCard}
        onVerb1AudioUpdated={(audioUrl) => handleAudioUpdated('verb', audioUrl)}
        onVerb2AudioUpdated={(audioUrl) => handleAudioUpdated('pairVerb', audioUrl)}
      />
      {confirmDialog}
    </>
  );
}
